-- Server-owned revision amounts. Additive migration; no existing quote is rewritten.
CREATE OR REPLACE FUNCTION public.save_issued_quote_revision(
  quote_id uuid, expected_updated_at timestamptz, patch jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
  previous public.saved_quotes%ROWTYPE;
  revised public.saved_quotes%ROWTYPE;
  actor uuid := auth.uid();
  actor_name text;
  item jsonb;
  selection jsonb;
  old_item jsonb;
  changed_items jsonb := '[]';
  spec_changed boolean := false;
  price_changed boolean := false;
  manual_adjustment jsonb;
  computed_subtotal numeric := 0;
  next_version integer;
  amount_policy_version integer;
  amount_mode text;
  automatic_subtotal numeric;
  automatic_tax numeric;
  automatic_total numeric;
  amount_details text;
  allowed text[] := ARRAY['project_name','quote_date_display','valid_until','delivery_period','payment_condition',
    'recipient_name','recipient_company','recipient_phone','recipient_email','recipient_address','recipient_memo',
    'quote_notes','desired_delivery_date','issuer_id','issuer_name','issuer_email','issuer_phone',
    'attachments','items','calculation_snapshot','subtotal','tax','total','amount_policy_version','amount_mode','manual_total','request_id'];
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(patch) IS DISTINCT FROM 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(patch) k WHERE NOT k = ANY(allowed)) THEN
    RAISE EXCEPTION '허용되지 않은 견적 수정 필드입니다.' USING ERRCODE = '22023';
  END IF;
  IF patch ? 'amount_policy_version' THEN
    IF jsonb_typeof(patch->'amount_policy_version') IS DISTINCT FROM 'number'
      OR patch->>'amount_policy_version' <> '1' THEN
      RAISE EXCEPTION '금액 저장 규칙이 변경되었습니다. 편집 내용을 복사한 뒤 새로고침해 주세요.'
        USING ERRCODE = 'PQA02', DETAIL = '{"serverAmountPolicyVersion":1}';
    END IF;
    amount_policy_version := 1;
    amount_mode := patch->>'amount_mode';
    IF amount_mode IS NULL OR amount_mode NOT IN ('preserve','automatic','manual')
      OR patch ?| ARRAY['subtotal','tax','total']
      OR (amount_mode <> 'manual' AND patch ? 'manual_total') THEN
      RAISE EXCEPTION '금액 변경 방식과 품목 입력을 확인해 주세요.' USING ERRCODE = 'PQA01';
    END IF;
  ELSIF patch ?| ARRAY['amount_mode','manual_total'] THEN
    RAISE EXCEPTION '금액 저장 규칙이 변경되었습니다. 편집 내용을 복사한 뒤 새로고침해 주세요.'
      USING ERRCODE = 'PQA02', DETAIL = '{"serverAmountPolicyVersion":1}';
  END IF;
  IF patch ? 'request_id' AND (jsonb_typeof(patch->'request_id') IS DISTINCT FROM 'string'
    OR patch->>'request_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION '저장 요청 식별자가 유효하지 않습니다.' USING ERRCODE = '22023';
  END IF;
  SELECT q.* INTO previous FROM public.saved_quotes q WHERE q.id = quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '견적을 찾을 수 없거나 수정 권한이 없습니다.' USING ERRCODE = '42501'; END IF;
  IF expected_updated_at IS NULL OR previous.updated_at IS DISTINCT FROM expected_updated_at THEN
    RAISE EXCEPTION '다른 사용자가 견적을 수정했습니다. 최신 견적을 확인해 주세요.' USING ERRCODE = '40001';
  END IF;
  revised := jsonb_populate_record(previous, patch);
  IF jsonb_typeof(revised.items) IS DISTINCT FROM 'array' OR jsonb_array_length(revised.items) = 0 OR jsonb_array_length(revised.items) > 500 THEN
    RAISE EXCEPTION '견적 품목을 확인해 주세요.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(revised.items) r GROUP BY r->>'id' HAVING count(*) > 1) THEN
    RAISE EXCEPTION '품목 ID가 중복되었습니다.' USING ERRCODE = '22023';
  END IF;
  price_changed := jsonb_array_length(previous.items) IS DISTINCT FROM jsonb_array_length(revised.items);
  FOR item IN SELECT * FROM jsonb_array_elements(revised.items) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR coalesce(btrim(item->>'id'), '') = ''
      OR jsonb_typeof(item->'quantity') IS DISTINCT FROM 'number' OR (item->>'quantity')::numeric < 1
      OR (item->>'quantity')::numeric <> trunc((item->>'quantity')::numeric)
      OR jsonb_typeof(item->'totalPrice') IS DISTINCT FROM 'number' OR (item->>'totalPrice')::numeric < 0
      OR (amount_policy_version = 1 AND amount_mode <> 'preserve' AND
        ((item->>'quantity')::numeric > 9007199254740991 OR (item->>'totalPrice')::numeric > 9007199254740991)) THEN
      RAISE EXCEPTION '품목 ID·수량·단가가 유효하지 않습니다.' USING ERRCODE = '22023';
    END IF;
    computed_subtotal := computed_subtotal + (item->>'quantity')::numeric * (item->>'totalPrice')::numeric;
    SELECT r INTO old_item FROM jsonb_array_elements(previous.items) r WHERE r->>'id' = item->>'id';
    IF old_item IS NULL OR (item->'quantity', item->'totalPrice') IS DISTINCT FROM (old_item->'quantity', old_item->'totalPrice') THEN
      price_changed := true;
    END IF;
    IF old_item IS DISTINCT FROM item THEN
      changed_items := changed_items || jsonb_build_array(jsonb_build_object('id', item->>'id', 'before', old_item, 'after', item));
    END IF;
    IF item->>'material' = '아크릴 판' AND old_item IS NOT NULL AND (
      (item->'quality', item->'selectedColor', item->'colorType', item->'specDisplay', item->'thickness', item->'size', item->'surface', item#>'{calculationSnapshot,selectedOptions}')
      IS DISTINCT FROM (old_item->'quality', old_item->'selectedColor', old_item->'colorType', old_item->'specDisplay', old_item->'thickness', old_item->'size', old_item->'surface', old_item#>'{calculationSnapshot,selectedOptions}')
    ) THEN
      spec_changed := true;
      IF coalesce(item#>>'{calculationSnapshot,selectedOptions,qualityId}', '') = ''
        OR coalesce(item#>>'{calculationSnapshot,selectedOptions,colorId}', '') = ''
        OR coalesce(item#>>'{calculationSnapshot,pricingVersion,id}', '') = ''
        OR coalesce(item#>>'{calculationSnapshot,calculationStatus}', '') NOT IN ('calculable', 'needs_review')
        OR (item#>>'{calculationSnapshot,totalPrice}')::numeric IS DISTINCT FROM (item->>'totalPrice')::numeric
        OR (item#>>'{calculationSnapshot,calculationStatus}' = 'needs_review' AND item#>>'{calculationSnapshot,selectedOptions,reviewAcknowledged}' IS DISTINCT FROM 'true') THEN
        RAISE EXCEPTION '등록 계산 기준과 검수된 재계산 결과가 필요합니다.' USING ERRCODE = '22023';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.color_options c JOIN public.panel_masters m ON m.id = c.panel_master_id
        WHERE c.id::text = item#>>'{calculationSnapshot,selectedOptions,colorId}' AND c.is_active AND c.is_producible IS DISTINCT FROM false
          AND m.quality::text = CASE WHEN item#>>'{calculationSnapshot,selectedOptions,qualityId}' = 'satin-mirror' THEN 'glossy-color' ELSE item#>>'{calculationSnapshot,selectedOptions,qualityId}' END
          AND split_part(c.color_name, ' ', 1) = item->>'selectedColor') THEN
        RAISE EXCEPTION '유효한 등록 컬러가 필요합니다.' USING ERRCODE = '22023';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.panel_pricing_versions v WHERE v.id::text = item#>>'{calculationSnapshot,pricingVersion,id}' AND v.is_active) THEN
        RAISE EXCEPTION '현재 단가표 기준을 확인해 주세요.' USING ERRCODE = '22023';
      END IF;
      IF jsonb_typeof(item#>'{calculationSnapshot,selectedOptions,sizes}') IS DISTINCT FROM 'array'
        OR jsonb_array_length(item#>'{calculationSnapshot,selectedOptions,sizes}') = 0
        OR item#>>'{calculationSnapshot,selectedOptions,thickness}' IS DISTINCT FROM item->>'thickness'
        OR item#>>'{calculationSnapshot,selectedOptions,qualityName}' IS DISTINCT FROM item->>'quality'
        OR item#>>'{calculationSnapshot,selectedOptions,selectedColor}' IS DISTINCT FROM item->>'selectedColor'
        OR item#>>'{calculationSnapshot,selectedOptions,materialId}' IS DISTINCT FROM 'casting'
        OR item#>>'{calculationSnapshot,selectedOptions,factory}' IS DISTINCT FROM 'jangwon'
        OR jsonb_typeof(item->'breakdown') IS DISTINCT FROM 'array'
        OR item#>'{calculationSnapshot,breakdown}' IS DISTINCT FROM item->'breakdown' THEN
        RAISE EXCEPTION '표시 사양과 구조화된 계산 근거가 일치하지 않습니다.' USING ERRCODE = '22023';
      END IF;
      FOR selection IN SELECT * FROM jsonb_array_elements(item#>'{calculationSnapshot,selectedOptions,sizes}') LOOP
        IF coalesce(selection->>'size', '') = '' OR coalesce(selection->>'surface', '') NOT IN ('단면','양면')
          OR jsonb_typeof(selection->'quantity') IS DISTINCT FROM 'number' OR (selection->>'quantity')::numeric <= 0
          OR (selection->>'quantity')::numeric <> trunc((selection->>'quantity')::numeric)
          OR jsonb_typeof(selection->'colorMixingCost') IS DISTINCT FROM 'number' OR (selection->>'colorMixingCost')::numeric < 0 THEN
          RAISE EXCEPTION '원판별 규격·장수·면수·조색비를 확인해 주세요.' USING ERRCODE = '22023';
        END IF;
      END LOOP;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(item->'breakdown') b WHERE jsonb_typeof(b->'price') IS DISTINCT FROM 'number')
        OR (SELECT coalesce(sum((b->>'price')::numeric), 0) FROM jsonb_array_elements(item->'breakdown') b) <> (item->>'totalPrice')::numeric THEN
        RAISE EXCEPTION '계산 내역과 단가가 일치하지 않습니다.' USING ERRCODE = '22023';
      END IF;
      IF jsonb_typeof(item->'specDisplay') NOT IN ('object','null')
        OR jsonb_typeof(item#>'{specDisplay,qualityName}') NOT IN ('string','null')
        OR jsonb_typeof(item#>'{specDisplay,colorName}') NOT IN ('string','null')
        OR length(coalesce(item#>>'{specDisplay,qualityName}', '')) > 200
        OR length(coalesce(item#>>'{specDisplay,colorName}', '')) > 200 THEN
        RAISE EXCEPTION '사양 표시명을 확인해 주세요.' USING ERRCODE = '22023';
      END IF;
    END IF;
  END LOOP;
  automatic_subtotal := round(computed_subtotal / 100) * 100;
  automatic_tax := round(automatic_subtotal * 0.1);
  automatic_total := round((automatic_subtotal + automatic_tax) / 100) * 100;
  amount_details := jsonb_build_object('serverAmountPolicyVersion', 1,
    'submitted', jsonb_build_object('subtotal', revised.subtotal, 'tax', revised.tax, 'total', revised.total),
    'expected', jsonb_build_object('subtotal', automatic_subtotal, 'tax', automatic_tax, 'total', automatic_total))::text;
  IF amount_policy_version = 1 THEN
    IF amount_mode = 'preserve' THEN
      IF price_changed OR spec_changed
        OR (revised.subtotal, revised.tax, revised.total) IS DISTINCT FROM (previous.subtotal, previous.tax, previous.total)
        OR coalesce(revised.calculation_snapshot->'manualTotalAdjustment', 'null'::jsonb)
          IS DISTINCT FROM coalesce(previous.calculation_snapshot->'manualTotalAdjustment', 'null'::jsonb) THEN
        RAISE EXCEPTION '품목 금액을 변경할 때는 자동 계산 또는 수동 총액 조정을 선택해 주세요.'
          USING ERRCODE = 'PQA01', DETAIL = amount_details;
      END IF;
      -- Metadata edits must not normalize historical money or rewrite its evidence.
      revised.calculation_snapshot := previous.calculation_snapshot;
    ELSE
      revised.subtotal := automatic_subtotal;
      revised.tax := automatic_tax;
      revised.total := automatic_total;
      manual_adjustment := NULL;
      IF amount_mode = 'manual' THEN
        IF spec_changed THEN
          RAISE EXCEPTION '사양 변경 시 수동 총액 조정을 해제해야 합니다.' USING ERRCODE = 'PQA01', DETAIL = amount_details;
        END IF;
        IF jsonb_typeof(patch->'manual_total') IS DISTINCT FROM 'number'
          OR (patch->>'manual_total')::numeric <= 0
          OR (patch->>'manual_total')::numeric <> trunc((patch->>'manual_total')::numeric)
          OR (patch->>'manual_total')::numeric > 9007199254740991 THEN
          RAISE EXCEPTION '수동 총액은 유효한 양의 원 단위 금액이어야 합니다.' USING ERRCODE = 'PQA01', DETAIL = amount_details;
        END IF;
        revised.total := (patch->>'manual_total')::numeric;
        revised.subtotal := round(revised.total / 1.1);
        revised.tax := revised.total - revised.subtotal;
        manual_adjustment := jsonb_build_object('mode', 'vat_included_total_override', 'adjustedAt', clock_timestamp(),
          'previousSubtotal', automatic_subtotal, 'previousTax', automatic_tax, 'previousTotal', automatic_total,
          'adjustedSubtotal', revised.subtotal, 'adjustedTax', revised.tax, 'adjustedTotal', revised.total,
          'difference', revised.total - automatic_total);
      END IF;
      revised.calculation_snapshot := (CASE WHEN jsonb_typeof(revised.calculation_snapshot) = 'object'
        THEN revised.calculation_snapshot ELSE '{}'::jsonb END) || jsonb_build_object(
        'subtotal', revised.subtotal, 'tax', revised.tax, 'total', revised.total,
        'autoCalculatedSubtotal', automatic_subtotal, 'autoCalculatedTax', automatic_tax, 'autoCalculatedTotal', automatic_total,
        'manualTotalAdjustment', manual_adjustment, 'amountPolicyVersion', 1, 'amountMode', amount_mode);
    END IF;
  END IF;
  IF revised.subtotal IS NULL OR revised.tax IS NULL OR revised.total IS NULL
    OR revised.subtotal < 0 OR revised.tax < 0 OR revised.total <= 0
    OR revised.subtotal::text IN ('NaN', 'Infinity', '-Infinity')
    OR revised.tax::text IN ('NaN', 'Infinity', '-Infinity')
    OR revised.total::text IN ('NaN', 'Infinity', '-Infinity')
    OR (amount_policy_version = 1 AND amount_mode <> 'preserve' AND revised.total > 9007199254740991)
    OR (amount_mode IS DISTINCT FROM 'preserve' AND NOT (revised.total = revised.subtotal + revised.tax
      OR (revised.subtotal = round(revised.subtotal / 100) * 100
        AND revised.tax = round(revised.subtotal * 0.1)
        AND revised.total = round((revised.subtotal + revised.tax) / 100) * 100))) THEN
    RAISE EXCEPTION '견적 금액이 유효하지 않습니다.' USING ERRCODE = 'PQA01', DETAIL = amount_details;
  END IF;
  IF amount_policy_version IS NULL THEN
  IF spec_changed AND (revised.subtotal <> round(computed_subtotal / 100) * 100
    OR revised.tax <> round(revised.subtotal * 0.1)
    OR revised.total <> round((revised.subtotal + revised.tax) / 100) * 100
    OR coalesce(revised.calculation_snapshot->'manualTotalAdjustment', 'null'::jsonb) <> 'null'::jsonb) THEN
    RAISE EXCEPTION '사양 변경 시 품목 합계로 계산하고 수동 총액 조정을 해제해야 합니다.' USING ERRCODE = '22023';
  END IF;

  -- Compatibility is only for unchanged financial values. New financial edits use
  -- the issued automatic rule or the existing explicit VAT-included manual policy.
  manual_adjustment := revised.calculation_snapshot->'manualTotalAdjustment';
  IF price_changed OR spec_changed
    OR (revised.subtotal, revised.tax, revised.total) IS DISTINCT FROM (previous.subtotal, previous.tax, previous.total)
    OR coalesce(manual_adjustment, 'null'::jsonb) IS DISTINCT FROM coalesce(previous.calculation_snapshot->'manualTotalAdjustment', 'null'::jsonb) THEN
    IF coalesce(manual_adjustment, 'null'::jsonb) <> 'null'::jsonb THEN
      IF manual_adjustment->>'mode' IS DISTINCT FROM 'vat_included_total_override'
        OR (manual_adjustment->>'adjustedSubtotal')::numeric IS DISTINCT FROM revised.subtotal
        OR (manual_adjustment->>'adjustedTax')::numeric IS DISTINCT FROM revised.tax
        OR (manual_adjustment->>'adjustedTotal')::numeric IS DISTINCT FROM revised.total
        OR revised.total <> trunc(revised.total)
        OR revised.subtotal <> round(revised.total / 1.1)
        OR revised.tax <> revised.total - revised.subtotal THEN
        RAISE EXCEPTION '수동 총액 역산 금액이 유효하지 않습니다.' USING ERRCODE = '22023';
      END IF;
    ELSIF revised.subtotal <> round(computed_subtotal / 100) * 100
      OR revised.tax <> round(revised.subtotal * 0.1)
      OR revised.total <> round((revised.subtotal + revised.tax) / 100) * 100 THEN
      IF revised.subtotal = automatic_subtotal AND revised.tax = automatic_tax
        AND revised.total = revised.subtotal + revised.tax AND revised.total <> automatic_total THEN
        RAISE EXCEPTION '품목 합계의 반올림 기준이 변경되었습니다. 편집 내용을 복사한 뒤 새로고침해 주세요.'
          USING ERRCODE = 'PQA02', DETAIL = amount_details;
      END IF;
      RAISE EXCEPTION '품목 합계와 견적 금액이 일치하지 않습니다.' USING ERRCODE = 'PQA01', DETAIL = amount_details;
    END IF;
  END IF;

  END IF; -- Legacy clients retain strict recognized amount validation until refreshed.

  SELECT coalesce(nullif(p.full_name, ''), actor::text) INTO actor_name FROM public.profiles p WHERE p.id = actor;
  actor_name := coalesce(actor_name, actor::text);
  UPDATE public.saved_quotes q SET
    project_name = revised.project_name, quote_date_display = revised.quote_date_display, valid_until = revised.valid_until,
    delivery_period = revised.delivery_period, payment_condition = revised.payment_condition,
    recipient_name = revised.recipient_name, recipient_company = revised.recipient_company,
    recipient_phone = revised.recipient_phone, recipient_email = revised.recipient_email,
    recipient_address = revised.recipient_address, recipient_memo = revised.recipient_memo,
    quote_notes = revised.quote_notes, desired_delivery_date = revised.desired_delivery_date,
    issuer_id = revised.issuer_id, issuer_name = revised.issuer_name, issuer_email = revised.issuer_email, issuer_phone = revised.issuer_phone,
    attachments = revised.attachments, items = revised.items, calculation_snapshot = revised.calculation_snapshot,
    subtotal = revised.subtotal, tax = revised.tax, total = revised.total, updated_at = clock_timestamp()
  WHERE q.id = quote_id RETURNING q.* INTO revised;
  IF NOT FOUND THEN RAISE EXCEPTION '견적 수정 권한이 없습니다.' USING ERRCODE = '42501'; END IF;

  SELECT coalesce(max(v.version_number), 0) + 1 INTO next_version FROM public.quote_versions v WHERE v.quote_id = previous.id;
  INSERT INTO public.quote_versions(quote_id, version_number, snapshot, change_summary, changed_by, changed_by_name)
    VALUES (previous.id, next_version, to_jsonb(previous), CASE WHEN spec_changed THEN '재질·컬러 및 금액 변경' ELSE '견적 수정' END, actor, actor_name);
  INSERT INTO public.quote_activity_history(quote_id, action_type, actor_id, actor_name, memo, metadata)
    VALUES (previous.id, 'quote_updated', actor, actor_name, '견적과 수정 이력 저장',
      jsonb_build_object('versionNumber', next_version, 'changedItems', changed_items, 'previousTotal', previous.total,
        'total', revised.total, 'specChanged', spec_changed, 'expectedUpdatedAt', expected_updated_at, 'updatedAt', revised.updated_at,
        'requestId', patch->>'request_id', 'amountPolicyVersion', coalesce(amount_policy_version, 0), 'amountMode', coalesce(amount_mode, 'legacy')));
  RETURN jsonb_build_object('id', revised.id, 'updated_at', revised.updated_at, 'version_number', next_version,
    'amount_policy_version', 1, 'subtotal', revised.subtotal, 'tax', revised.tax, 'total', revised.total,
    'calculation_snapshot', revised.calculation_snapshot);
END;
$$;
REVOKE ALL ON FUNCTION public.save_issued_quote_revision(uuid, timestamptz, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_issued_quote_revision(uuid, timestamptz, jsonb) TO authenticated;
