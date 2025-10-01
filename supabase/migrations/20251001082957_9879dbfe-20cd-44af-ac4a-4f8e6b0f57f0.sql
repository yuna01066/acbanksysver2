-- Continue glossy-standard (12T through 30T)
DO $$
DECLARE
  v_master_id uuid;
  v_size_id uuid;
BEGIN
  SELECT id INTO v_master_id FROM panel_masters WHERE quality = 'glossy-standard';
  
  -- 12T
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '12T', '3*6', 880, 1770, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 110300, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '12T', '대3*6', 920, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 119100, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '12T', '4*5', 1140, 1445, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 115800, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '12T', '대4*5', 1220, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 130700, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '12T', '1*2', 1020, 2020, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 144300, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '12T', '4*6', 1220, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 155400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '12T', '4*8', 1220, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 205800, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '12T', '5*5', 1520, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 220700, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '12T', '5*6', 1520, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 263000, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '12T', '5*8', 1520, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 346800, now());
  
  -- 15T
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '15T', '3*6', 880, 1770, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 138300, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '15T', '대3*6', 920, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 148000, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '15T', '4*5', 1140, 1445, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 145100, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '15T', '대4*5', 1220, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 163900, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '15T', '1*2', 1020, 2020, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 181400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '15T', '4*6', 1220, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 194400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '15T', '4*8', 1220, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 257400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '15T', '5*5', 1520, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 282500, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '15T', '5*6', 1520, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 336400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '15T', '5*8', 1520, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 444300, now());
  
  -- 20T
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '20T', '3*6', 880, 1770, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 195200, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '20T', '대3*6', 920, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 210000, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '20T', '4*5', 1140, 1445, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 205800, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '20T', '대4*5', 1220, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 232200, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '20T', '1*2', 1020, 2020, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 257000, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '20T', '4*6', 1220, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 277000, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '20T', '4*8', 1220, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 366900, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '20T', '5*5', 1520, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 398800, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '20T', '5*6', 1520, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 475600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '20T', '5*8', 1520, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 629100, now());
  
  -- 25T
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '25T', '3*6', 880, 1770, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 252200, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '25T', '대3*6', 920, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 272200, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '25T', '4*5', 1140, 1445, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 266600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '25T', '대4*5', 1220, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 300400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '25T', '1*2', 1020, 2020, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 332500, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '25T', '4*6', 1220, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 359700, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '25T', '4*8', 1220, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 476800, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '25T', '5*5', 1520, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 511000, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '25T', '5*6', 1520, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 611100, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '25T', '5*8', 1520, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 811400, now());
  
  -- 30T
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '30T', '3*6', 880, 1770, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 313800, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '30T', '대3*6', 920, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 338400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '30T', '4*5', 1140, 1445, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 331400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '30T', '대4*5', 1220, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 374700, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '30T', '1*2', 1020, 2020, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 414500, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '30T', '4*6', 1220, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 448400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '30T', '4*8', 1220, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 595600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '30T', '5*5', 1520, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 637800, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '30T', '5*6', 1520, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 764100, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '30T', '5*8', 1520, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 1016100, now());
  
END $$;