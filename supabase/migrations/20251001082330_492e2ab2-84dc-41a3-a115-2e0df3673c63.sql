-- Insert panel sizes and prices for Bright (브라이트/satin-color)
-- Get the panel_master_id for satin-color
DO $$
DECLARE
  v_master_id uuid;
  v_size_id uuid;
BEGIN
  -- Get the master ID
  SELECT id INTO v_master_id FROM panel_masters WHERE quality = 'satin-color';
  
  -- 1.3T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '1.3T', '대3*6', 920, 1820, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 32200, now());
  
  -- 1.5T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '1.5T', '대3*6', 920, 1820, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 32200, now());
  
  -- 2T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '2T', '대3*6', 920, 1820, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 32200, now());
  
  -- 3T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '3T', '대3*6', 920, 1820, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 39600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '3T', '1*2', 1020, 2020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 48700, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '3T', '4*8', 1220, 2420, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 67100, now());
  
  -- 4T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '4T', '대3*6', 920, 1820, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 50100, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '4T', '1*2', 1020, 2020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 61500, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '4T', '4*8', 1220, 2420, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 85600, now());
  
  -- 5T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '5T', '대3*6', 920, 1820, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 60600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '5T', '1*2', 1020, 2020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 73700, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '5T', '4*8', 1220, 2420, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 102600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '5T', '4*10', 1220, 3020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 190000, now());
  
  -- 6T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '6T', '대3*6', 920, 1820, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 71100, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '6T', '1*2', 1020, 2020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 86200, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '6T', '4*8', 1220, 2420, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 121600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '6T', '4*10', 1220, 3020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 223800, now());
  
  -- 8T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '8T', '대3*6', 920, 1820, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 91600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '8T', '1*2', 1020, 2020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 111200, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '8T', '4*8', 1220, 2420, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 157100, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '8T', '4*10', 1220, 3020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 290500, now());
  
  -- 10T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '10T', '대3*6', 920, 1820, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 110600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '10T', '1*2', 1020, 2020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 135700, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '10T', '4*8', 1220, 2420, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 191600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '10T', '4*10', 1220, 3020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 356500, now());
  
  -- 12T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '12T', '대3*6', 920, 1820, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 142700, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '12T', '1*2', 1020, 2020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 173400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '12T', '4*8', 1220, 2420, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 246600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '12T', '4*10', 1220, 3020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 458100, now());
  
  -- 15T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '15T', '대3*6', 920, 1820, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 175400, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '15T', '1*2', 1020, 2020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 214700, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '15T', '4*8', 1220, 2420, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 305100, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '15T', '4*10', 1220, 3020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 566200, now());
  
  -- 20T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '20T', '대3*6', 920, 1820, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 236500, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '20T', '1*2', 1020, 2020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 289900, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '20T', '4*8', 1220, 2420, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 413600, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '20T', '4*10', 1220, 3020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 770200, now());
  
  -- 25T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '25T', '대3*6', 920, 1820, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 305300, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '25T', '1*2', 1020, 2020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 375200, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '25T', '4*8', 1220, 2420, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 538300, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '25T', '4*10', 1220, 3020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 1004700, now());
  
  -- 30T sizes
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '30T', '대3*6', 920, 1820, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 372700, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '30T', '1*2', 1020, 2020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 459500, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '30T', '4*8', 1220, 2420, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 662900, now());
  
  INSERT INTO panel_sizes (panel_master_id, thickness, size_name, actual_width, actual_height, is_active)
  VALUES (v_master_id, '30T', '4*10', 1220, 3020, true)
  RETURNING id INTO v_size_id;
  INSERT INTO panel_prices (panel_size_id, price, effective_from) VALUES (v_size_id, 1240800, now());
  
END $$;