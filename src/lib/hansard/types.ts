// Types based on Hansard API examples

// From /debates/{debateId} endpoint
export interface DebateResponse {
  Overview: DebateOverview;
  Navigator: NavigatorItem[];
  Items: DebateContentItem[];
  ChildDebates: any[]; // Assuming structure based on name, might need refinement
}

export interface DebateOverview {
  Id: number;
  ExtId: string;
  Title: string;
  HRSTag: string | null;
  Date: string; // ISO 8601 format
  Location: string;
  House: string;
  Source: number;
  VolumeNo: number;
  ContentLastUpdated: string; // ISO 8601 format
  DebateTypeId: number;
  SectionType: number;
  NextDebateExtId: string | null;
  NextDebateTitle: string | null;
  PreviousDebateExtId: string | null;
  PreviousDebateTitle: string | null;
}

export interface NavigatorItem {
  Id: number;
  Title: string;
  ParentId: number | null;
  SortOrder: number;
  ExternalId: string;
  HRSTag: string | null;
  HansardSection: string | null;
  Timecode: string | null; // ISO 8601 format or null
}

export interface DebateContentItem {
  ItemType: "Timestamp" | "Contribution"; // Add other types if they exist
  ItemId: number;
  MemberId: number | null;
  AttributedTo: string | null;
  Value: string; // Contains HTML content
  OrderInSection: number;
  Timecode: string | null; // ISO 8601 format or null
  ExternalId: string | null;
  HRSTag: string | null;
  HansardSection: string | null;
  UIN: string | null;
  IsReiteration: boolean;
}

// From /search endpoint
export interface SearchResult {
  TotalMembers: number;
  TotalContributions: number;
  TotalWrittenStatements: number;
  TotalWrittenAnswers: number;
  TotalCorrections: number;
  TotalPetitions: number;
  TotalDebates: number;
  TotalCommittees: number;
  TotalDivisions: number;
  SearchTerms: string[];
  Members: Member[];
  Contributions: Contribution[];
  WrittenStatements: WrittenStatement[];
  WrittenAnswers: any[]; // Type based on name, might need refinement if example provided
  Corrections: Correction[];
  Petitions: any[]; // Type based on name, might need refinement if example provided
  Debates: DebateSummary[];
  Divisions: Division[];
  Committees: Committee[];
}

export interface Member {
  MemberId: number;
  DodsId: number;
  PimsId: number;
  DisplayAs: string;
  ListAs: string;
  FullTitle: string;
  LayingMinisterName: string | null;
  HistoricalMemberName: string | null;
  HistoricalFullTitle: string | null;
  Gender: string;
  Party: string;
  PartyId: number;
  House: string;
  MemberFrom: string;
  HouseStartDate: string; // ISO 8601 format
  HouseEndDate: string | null; // ISO 8601 format or null
  IsTeller: boolean;
  SortOrder: number;
  ConstituencyCountry: string;
}

export interface Contribution {
  MemberName: string;
  MemberId: number;
  AttributedTo: string;
  ItemId: number;
  ContributionExtId: string;
  ContributionText: string; // Snippet?
  ContributionTextFull: string; // Contains HTML content
  HRSTag: string;
  HansardSection: string;
  Timecode: string | null; // ISO 8601 format or null
  DebateSection: string;
  DebateSectionId: number;
  DebateSectionExtId: string;
  SittingDate: string; // ISO 8601 format
  Section: string;
  House: string;
  OrderInDebateSection: number;
  DebateSectionOrder: number;
  Rank: number;
}

export interface WrittenStatement {
  MemberName: string;
  MemberId: number;
  AttributedTo: string;
  ItemId: number;
  ContributionExtId: string;
  ContributionText: string; // Snippet?
  ContributionTextFull: string; // Contains HTML content
  HRSTag: string;
  HansardSection: string;
  Timecode: string | null; // ISO 8601 format or null
  DebateSection: string;
  DebateSectionId: number;
  DebateSectionExtId: string;
  SittingDate: string; // ISO 8601 format
  Section: string;
  House: string;
  OrderInDebateSection: number;
  DebateSectionOrder: number;
  Rank: number;
}

export interface Correction {
  MemberName: string;
  MemberId: number;
  AttributedTo: string;
  ItemId: number;
  ContributionExtId: string;
  ContributionText: string; // Snippet?
  ContributionTextFull: string; // Contains HTML content
  HRSTag: string;
  HansardSection: string;
  Timecode: string | null; // ISO 8601 format or null
  DebateSection: string;
  DebateSectionId: number;
  DebateSectionExtId: string;
  SittingDate: string; // ISO 8601 format
  Section: string;
  House: string;
  OrderInDebateSection: number;
  DebateSectionOrder: number;
  Rank: number;
}

export interface DebateSummary {
  DebateSection: string;
  SittingDate: string; // ISO 8601 format
  House: string;
  Title: string;
  Rank: number;
  DebateSectionExtId: string;
}

export interface Division {
  Id: number;
  Time: string | null;
  Date: string; // ISO 8601 format
  DivisionHasTime: boolean;
  ExternalId: string;
  AyesCount: number;
  NoesCount: number;
  House: string;
  DebateSection: string;
  DebateSectionSource: string;
  Number: string; // Number is a string in the example ("12", "11")
  DebateSectionExtId: string;
  MemberVotedAye: boolean | null;
  TextBeforeVote: string;
  TextAfterVote: string;
  EVELType: string | null;
  EVELInfo: string | null;
  EVELAyesCount: number | null;
  EVELNoesCount: number | null;
  IsCommitteeDivision: boolean;
}

export interface Committee {
  House: string;
  Title: string;
  DebateSection: string;
} 