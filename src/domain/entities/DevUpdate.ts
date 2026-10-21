export interface DevUpdateProps {
  readonly repoName: string;
  readonly branch: string;
  readonly author: string;
  readonly shortHash?: string | undefined;
  readonly completedChanges: readonly string[];
  readonly nextSteps: readonly string[];
  readonly blockers?: readonly string[] | undefined;
  readonly createdAt?: Date | undefined;
}

export class DevUpdate {
  public readonly repoName: string;
  public readonly branch: string;
  public readonly author: string;
  public readonly shortHash: string | undefined;
  public readonly completedChanges: readonly string[];
  public readonly nextSteps: readonly string[];
  public readonly blockers: readonly string[] | undefined;
  public readonly createdAt: Date;

  private constructor(props: DevUpdateProps) {
    this.repoName = props.repoName;
    this.branch = props.branch;
    this.author = props.author;
    this.shortHash = props.shortHash;
    this.completedChanges = Object.freeze([...props.completedChanges]);
    this.nextSteps = Object.freeze([...props.nextSteps]);
    this.blockers = props.blockers && props.blockers.length > 0 ? Object.freeze([...props.blockers]) : undefined;
    this.createdAt = props.createdAt ?? new Date();
    Object.freeze(this);
  }

  public static create(props: DevUpdateProps): DevUpdate {
    if (!props.repoName.trim()) {
      throw new Error("DevUpdate: repoName no puede estar vacío");
    }
    if (!props.branch.trim()) {
      throw new Error("DevUpdate: branch no puede estar vacío");
    }
    if (!props.author.trim()) {
      throw new Error("DevUpdate: author no puede estar vacío");
    }
    if (!props.completedChanges || props.completedChanges.length === 0) {
      throw new Error("DevUpdate: debe incluir al menos un cambio completado");
    }
    if (!props.nextSteps || props.nextSteps.length === 0) {
      throw new Error("DevUpdate: debe incluir al menos un siguiente paso");
    }

    return new DevUpdate(props);
  }
}
