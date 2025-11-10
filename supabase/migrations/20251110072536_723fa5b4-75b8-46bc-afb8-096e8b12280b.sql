-- panel_sizes 테이블에 실시간 업데이트 활성화
ALTER TABLE panel_sizes REPLICA IDENTITY FULL;

-- supabase_realtime publication에 panel_sizes 추가
ALTER PUBLICATION supabase_realtime ADD TABLE panel_sizes;