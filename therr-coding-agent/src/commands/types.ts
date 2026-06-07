export interface Command {
  /** Slash-command name (without the leading "/"). */
  name: string;
  description: string;
  argumentHint?: string;
  /** The markdown body, injected as a user message when invoked. */
  body: string;
  /** Absolute path the command was loaded from. */
  source: string;
}
