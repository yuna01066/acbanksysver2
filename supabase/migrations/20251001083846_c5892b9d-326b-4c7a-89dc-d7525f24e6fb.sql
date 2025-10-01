-- Add astel-color data
-- Note: astel-color uses special sizes including 소3*6 and 소1*2
DO $$
DECLARE
  v_master_id uuid;
  v_size_id uuid;
BEGIN
  SELECT id INTO v_master_id FROM panel_masters WHERE quality = 'astel-color';
  
  -- 1.3T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '1.3T', '소3*6', 870, 1770, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 27300, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '1.3T', '대3*6', 920, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 30200, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '1.3T', '4*5', 1140, 1445, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 30200, now());
  
  -- 1.5T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '1.5T', '소3*6', 870, 1770, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 27300, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '1.5T', '대3*6', 920, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 30200, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '1.5T', '4*5', 1140, 1445, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 30200, now());
  
  -- 2T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '2T', '소3*6', 870, 1770, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 27300, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '2T', '대3*6', 920, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 30200, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '2T', '4*5', 1140, 1445, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 30200, now());
  
  -- 3T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '3T', '소3*6', 870, 1770, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 33000, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '3T', '대3*6', 920, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 37600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '3T', '4*5', 1140, 1445, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 36900, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '3T', '대4*5', 1220, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 41600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '3T', '소1*2', 970, 1920, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 41900, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '3T', '1*2', 1020, 2020, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 46700, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '3T', '4*6', 1220, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 49500, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '3T', '4*8', 1220, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 65100, now());
  
  -- 4T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '4T', '소3*6', 870, 1770, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 42000, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '4T', '대3*6', 920, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 48100, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '4T', '4*5', 1140, 1445, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 47100, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '4T', '대4*5', 1220, 1520, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 53400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '4T', '소1*2', 970, 1920, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 53400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '4T', '1*2', 1020, 2020, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 59500, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '4T', '4*6', 1220, 1820, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 63200, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '4T', '4*8', 1220, 2420, true) RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 83600, now());
  
  -- 5T sizes (continuing with remaining thicknesses in next migration due to size constraints)
  
END $$;