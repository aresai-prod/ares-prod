export type RagContext = {
  snippets: string[];
  sources: string[];
};

export async function retrieveContext(_query: string): Promise<RagContext> {
  // TODO: Implement embeddings + vector store.
  return {
    snippets: [],
    sources: []
  };
}
