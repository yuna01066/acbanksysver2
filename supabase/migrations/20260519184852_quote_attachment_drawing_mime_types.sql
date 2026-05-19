UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/postscript',
  'application/illustrator',
  'application/acad',
  'application/x-acad',
  'application/autocad_dwg',
  'application/dwg',
  'application/x-dwg',
  'image/vnd.dwg',
  'application/dxf',
  'application/x-dxf',
  'image/vnd.dxf',
  'application/octet-stream'
]
WHERE id = 'quote-attachments';
