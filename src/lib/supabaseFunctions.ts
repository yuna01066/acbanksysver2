const DEFAULT_SUPABASE_URL = 'https://zwloyqcwyfkimwkohpnd.supabase.co';

export function getSupabaseFunctionUrl(functionName: string) {
  const configuredUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
  const supabaseUrl = configuredUrl || (projectId ? `https://${projectId}.supabase.co` : DEFAULT_SUPABASE_URL);

  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`;
}
