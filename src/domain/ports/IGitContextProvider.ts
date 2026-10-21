export interface GitContext {
  readonly repoName: string;
  readonly branch: string;
  readonly author: string;
  readonly shortHash?: string | undefined;
}

export interface IGitContextProvider {
  getContext(): GitContext;
}
