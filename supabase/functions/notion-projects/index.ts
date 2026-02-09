import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const NOTION_API_URL = 'https://api.notion.com/v1';
const DATABASE_ID = '302e58d26996819f868acd67b99c47a8';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY');
    if (!NOTION_API_KEY) {
      throw new Error('NOTION_API_KEY is not configured');
    }

    console.log('Fetching Notion database:', DATABASE_ID);

    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(`${NOTION_API_URL}/databases/${DATABASE_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page_size: 100 }),
      });
      if (response.ok || (response.status < 500)) break;
      console.warn(`Notion API attempt ${attempt + 1} failed with ${response.status}, retrying...`);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }

    if (!response || !response.ok) {
      const errorBody = response ? await response.text() : 'No response';
      const status = response?.status || 0;
      console.error('Notion API error:', status, errorBody.substring(0, 200));
      throw new Error(`Notion API call failed [${status}] after retries`);
    }

    const data = await response.json();
    console.log(`Fetched ${data.results?.length || 0} projects from Notion`);

    const projects = data.results.map((page: any) => {
      const properties = page.properties;
      
      let title = '';
      let createdDate = page.created_time;
      let startDate = '';
      let endDate = '';
      let assignee = '';
      let status = '';

      for (const [key, value] of Object.entries(properties)) {
        const prop = value as any;
        
        // Get title
        if (prop.type === 'title' && prop.title?.length > 0) {
          title = prop.title.map((t: any) => t.plain_text).join('');
        }
        
        // Get date property with start and end
        if (prop.type === 'date' && prop.date?.start) {
          startDate = prop.date.start;
          endDate = prop.date.end || '';
        }
        
        // created_time is always set from page.created_time above

        // Get person/people
        if (prop.type === 'people' && prop.people?.length > 0) {
          assignee = prop.people.map((p: any) => p.name || p.person?.email || '').filter(Boolean).join(', ');
        }
        
        // Get status
        if (prop.type === 'status' && prop.status?.name) {
          status = prop.status.name;
        }
        
        // Get select for status-like fields
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

    console.log('Processed projects:', projects.length);

    return new Response(JSON.stringify({ projects }), {
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
