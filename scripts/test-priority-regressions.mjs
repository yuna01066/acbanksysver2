import assert from 'node:assert/strict';
import fs from 'node:fs';

const projectRoot = new URL('../', import.meta.url);
const read = (relativePath) => fs.readFileSync(new URL(relativePath, projectRoot), 'utf8');

const driveFunction = read('supabase/functions/google-drive/index.ts');
const portfolioGallery = read('src/components/exhibition/PortfolioGallery.tsx');
const portfolioMigration = read('supabase/migrations/20260812090000_portfolio_security_hardening.sql');

assert.match(
  driveFunction,
  /const adminOnlyActions = new Set\(\[[\s\S]*?'upload-portfolio-image'[\s\S]*?'copy-portfolio-drive-files'[\s\S]*?'bulk-import-portfolio-folder'[\s\S]*?'delete-portfolio-file'/,
  'Every portfolio write action must remain admin-only',
);
assert.match(driveFunction, /adminOnlyActions\.has\(action\)[\s\S]*?\['admin'\]/);
assert.match(portfolioGallery, /const canManagePortfolio = Boolean\(user && isAdmin\)/);
assert.match(portfolioGallery, /created_by: user\.id/);
assert.match(portfolioGallery, /uploaded_by: user\.id/);

const deleteMutation = portfolioGallery.match(
  /const deleteMutation = useMutation\(\{[\s\S]*?\n  \}\);/,
)?.[0];
assert.ok(deleteMutation, 'Portfolio delete mutation must exist');
assert.ok(
  deleteMutation.indexOf(".from('portfolio_posts')") < deleteMutation.indexOf('cleanupPortfolioImageFiles'),
  'The DB delete permission check must happen before destructive Drive cleanup',
);
assert.match(portfolioMigration, /CREATE POLICY "Admins can delete portfolio posts"/);
assert.match(portfolioMigration, /CREATE POLICY "Admins can delete portfolio images"/);

const attendanceUniqueMigration = read('supabase/migrations/20260701062808_86ac8d6a-550f-450a-8a94-6011d8625bd9.sql');
const attendanceSecurityMigration = read('supabase/migrations/20260812090200_attendance_backup_security.sql');
const quickAttendance = read('src/components/QuickAttendanceButton.tsx');
const attendancePage = read('src/pages/AttendancePage.tsx');
const attendanceDashboard = read('src/components/attendance/AttendanceDashboard.tsx');
const monthlyReport = read('src/components/attendance/MonthlyAttendanceReport.tsx');

assert.match(
  attendanceUniqueMigration,
  /CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_user_id_date_unique_idx\s+ON public\.attendance_records \(user_id, date\)/,
);
assert.match(attendanceSecurityMigration, /attendance_records_duplicate_backup_20260701 ENABLE ROW LEVEL SECURITY/);
assert.match(attendanceSecurityMigration, /REVOKE ALL ON TABLE public\.attendance_records_duplicate_backup_20260701 FROM anon, authenticated/);
assert.doesNotMatch(quickAttendance, /\.maybeSingle\(\)/);
assert.match(quickAttendance, /isDuplicateAttendanceError/);
assert.doesNotMatch(attendancePage, /\.eq\('date', today\)\s*\.maybeSingle\(\)/);
assert.match(attendancePage, /existingRecord[\s\S]*?\.update\(manualData\)/);
assert.match(attendanceDashboard, /if \(error\) throw error/);
assert.match(attendanceDashboard, /if \(loadError\)/);
assert.match(monthlyReport, /if \(loadError\)/);

console.log('Priority security and attendance regression checks passed.');
