-- Add Mirror and Astel Mirror to panel_masters
INSERT INTO panel_masters (material, quality, name, description)
VALUES 
  ('acrylic', 'acrylic-mirror', '미러 아크릴', 'Mirror (미러) - 거울 아크릴'),
  ('acrylic', 'astel-mirror', '아스텔 미러 아크릴', 'Astel Mirror (아스텔 미러)')
ON CONFLICT DO NOTHING;

-- Continue glossy-standard data (6T through 30T)
DO $$
DECLARE
  v_master_id uuid;
  v_size_id uuid;
BEGIN
  SELECT id INTO v_master_id FROM panel_masters WHERE quality = 'glossy-standard';
  
  -- 6T
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '6T', '3*6', 880, 1770, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 53500, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '6T', '대3*6', 920, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 58000, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '6T', '4*5', 1140, 1445, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 56600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '6T', '대4*5', 1220, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 63400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '6T', '1*2', 1020, 2020, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 69800, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '6T', '4*6', 1220, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 75200, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '6T', '4*8', 1220, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 99000, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '6T', '5*5', 1520, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 106900, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '6T', '5*6', 1520, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 126300, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '6T', '5*8', 1520, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 165800, now());
  
  -- 8T
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '8T', '3*6', 880, 1770, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 70400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '8T', '대3*6', 920, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 76400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '8T', '4*5', 1140, 1445, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 74200, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '8T', '대4*5', 1220, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 83600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '8T', '1*2', 1020, 2020, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 92300, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '8T', '4*6', 1220, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 100000, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '8T', '4*8', 1220, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 131000, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '8T', '5*5', 1520, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 140900, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '8T', '5*6', 1520, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 167600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '8T', '5*8', 1520, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 220500, now());
  
  -- 10T
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '10T', '3*6', 880, 1770, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 87100, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '10T', '대3*6', 920, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 93500, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '10T', '4*5', 1140, 1445, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 91700, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '10T', '대4*5', 1220, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 103400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '10T', '1*2', 1020, 2020, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 114400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '10T', '4*6', 1220, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 122900, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '10T', '4*8', 1220, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 162000, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '10T', '5*5', 1520, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 174300, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '10T', '5*6', 1520, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 207700, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '10T', '5*8', 1520, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 273900, now());
  
END $$;