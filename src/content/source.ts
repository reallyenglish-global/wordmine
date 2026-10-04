import { parseActivityDocument, type ActivityDocument } from '../contract';

/** Where activity documents come from. The prototype bundles one fixture; a later source may call wm-api. */
export interface ContentSource {
  load(): Promise<ActivityDocument>;
}

export class BundledFixtureSource implements ContentSource {
  constructor(private readonly raw: unknown) {}

  async load(): Promise<ActivityDocument> {
    return parseActivityDocument(this.raw);
  }
}
