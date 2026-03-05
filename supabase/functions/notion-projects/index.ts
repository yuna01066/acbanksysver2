const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const NOTION_API_URL = 'https://api.notion.com/v1';
const DATABASE_ID = '302e58d26996819f868acd67b99c47a8';
const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

let cachedProjects: Array<Record<string, unknown>> | null = null;
let cacheExpiresAt = 0;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY');
    if (!NOTION_API_KEY) {
      console.error('Missing required secret for notion-projects', { hasNotionApiKey: false });
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (cachedProjects && Date.now() < cacheExpiresAt) {
      return new Response(JSON.stringify({ projects: cachedProjects, cached: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching Notion database:', DATABASE_ID);

    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort('notion-timeout'), REQUEST_TIMEOUT_MS);

      try {
        response = await fetch(`${NOTION_API_URL}/databases/${DATABASE_ID}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_API_KEY}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ page_size: 100 }),
          signal: controller.signal,
        });
      } catch (fetchError: unknown) {
        const reason = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
        console.warn(`Notion API attempt ${attempt + 1} failed: ${reason}`);
        if (attempt === 2) throw fetchError;
        await wait(500 * (attempt + 1));
        continue;
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.ok || response.status < 500) break;
      console.warn(`Notion API attempt ${attempt + 1} failed with ${response.status}, retrying...`);
      if (attempt < 2) await wait(1000 * (attempt + 1));
    }

    if (!response || !response.ok) {
      const errorBody = response ? await response.text() : 'No response';
      const status = response?.status || 0;
      console.error('Notion API error:', status, errorBody.substring(0, 200));
      throw new Error(`Notion API call failed [${status}] after retries`);
    }

    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    console.log(`Fetched ${results.length} projects from Notion`);

    const projects = results.map((page: any) => {
      const properties = page.properties || {};

      let title = '';
      let createdDate = page.created_time;
      let startDate = '';
      let endDate = '';
      let assignee = '';
      let status = '';

      for (const [key, value] of Object.entries(properties)) {
        const prop = value as any;

        if (prop.type === 'title' && prop.title?.length > 0) {
          title = prop.title.map((t: any) => t.plain_text).join('');
        }

        if (prop.type === 'date' && prop.date?.start) {
          startDate = prop.date.start;
          endDate = prop.date.end || '';
        }

        if (prop.type === 'people' && prop.people?.length > 0) {
          assignee = prop.people.map((p: any) => p.name || p.person?.email || '').filter(Boolean).join(', ');
        }

        if (prop.type === 'status' && prop.status?.name) {
          status = prop.status.name;
        }

        if (prop.type === 'select' && prop.select?.name) {
          if (key.includes('상태') || key.includes('status') || key.includes('Status')) {
            status = prop.select.name;
          }
          if (key.includes('담당') || key.includes('assign')) {
            assignee = prop.select.name;
          }
        }
      }

      return {
        id: page.id,
        title: title || 'Untitled',
        date: startDate || createdDate,
        createdDate,
        lastEditedTime: page.last_edited_time,
        startDate,
        endDate,
        assignee,
        assigneeList: assignee ? assignee.split(', ').map((a: string) => a.trim()) : [],
        status,
        url: page.url,
      };
    });

    cachedProjects = projects;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    console.log('Processed projects:', projects.length);

    return new Response(JSON.stringify({ projects, cached: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching Notion projects:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
