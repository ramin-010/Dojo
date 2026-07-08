import KnowledgeClient from './KnowledgeClient';
import { getKnowledgeData } from '@/app/actions/knowledge.actions';
import { DEV_WORKSPACE_ID } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function KnowledgeHubPage() {
  const result = await getKnowledgeData(DEV_WORKSPACE_ID);
  
  if (!result.success) {
    return (
      <div className="p-8 max-w-[1100px] mx-auto w-full h-full flex flex-col items-center justify-center">
        <div className="bg-sidebar/30 border border-dashed border-red-500/30 rounded-xl p-8 text-center">
          <p className="text-red-400 font-semibold mb-2">Failed to load Knowledge Hub</p>
          <p className="text-sm text-foreground/50">{result.error}</p>
        </div>
      </div>
    );
  }

  const { tags = [], topics = [], notes = [] } = result;

  return (
    <KnowledgeClient 
      initialTags={tags} 
      initialTopics={topics} 
      initialNotes={notes} 
    />
  );
}
