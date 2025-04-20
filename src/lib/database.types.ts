export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      casual_debates_uwhatgov: {
        Row: {
          content: string | null
          created_at: string
          error_message: string | null
          id: string
          last_accessed_at: string | null
          last_updated_at: string
          status: string
          summary: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          error_message?: string | null
          id: string
          last_accessed_at?: string | null
          last_updated_at?: string
          status?: string
          summary?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          last_accessed_at?: string | null
          last_updated_at?: string
          status?: string
          summary?: string | null
        }
        Relationships: []
      }
      debate_votes: {
        Row: {
          created_at: string | null
          debate_id: string
          id: string
          user_id: string
          vote: boolean
        }
        Insert: {
          created_at?: string | null
          debate_id: string
          id?: string
          user_id: string
          vote: boolean
        }
        Update: {
          created_at?: string | null
          debate_id?: string
          id?: string
          user_id?: string
          vote?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "debate_votes_debate_id_fkey"
            columns: ["debate_id"]
            isOneToOne: false
            referencedRelation: "debates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_votes_debate_id_fkey"
            columns: ["debate_id"]
            isOneToOne: false
            referencedRelation: "mp_key_points"
            referencedColumns: ["debate_id"]
          },
        ]
      }
      debates: {
        Row: {
          ai_comment_thread: Json
          ai_key_points: Json
          ai_overview: string | null
          ai_question: string
          ai_question_ayes: number
          ai_question_noes: number
          ai_question_subtopics: string[] | null
          ai_question_topic: string
          ai_summary: string
          ai_title: string | null
          ai_tone: string | null
          ai_topics: Json
          analysis: string | null
          contribution_count: number
          created_at: string | null
          date: string
          day_of_week: string | null
          ext_id: string
          file_id: string | null
          house: string
          id: string
          interest_factors: Json | null
          interest_score: number | null
          last_updated: string | null
          location: string
          next_ext_id: string | null
          parent_ext_id: string
          parent_title: string
          party_count: Json | null
          prev_ext_id: string | null
          search_text: string | null
          search_vector: unknown | null
          speaker_count: number
          speakers: Json | null
          start_time: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          ai_comment_thread?: Json
          ai_key_points?: Json
          ai_overview?: string | null
          ai_question?: string
          ai_question_ayes?: number
          ai_question_noes?: number
          ai_question_subtopics?: string[] | null
          ai_question_topic?: string
          ai_summary?: string
          ai_title?: string | null
          ai_tone?: string | null
          ai_topics?: Json
          analysis?: string | null
          contribution_count?: number
          created_at?: string | null
          date: string
          day_of_week?: string | null
          ext_id: string
          file_id?: string | null
          house: string
          id?: string
          interest_factors?: Json | null
          interest_score?: number | null
          last_updated?: string | null
          location: string
          next_ext_id?: string | null
          parent_ext_id: string
          parent_title: string
          party_count?: Json | null
          prev_ext_id?: string | null
          search_text?: string | null
          search_vector?: unknown | null
          speaker_count?: number
          speakers?: Json | null
          start_time?: string | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          ai_comment_thread?: Json
          ai_key_points?: Json
          ai_overview?: string | null
          ai_question?: string
          ai_question_ayes?: number
          ai_question_noes?: number
          ai_question_subtopics?: string[] | null
          ai_question_topic?: string
          ai_summary?: string
          ai_title?: string | null
          ai_tone?: string | null
          ai_topics?: Json
          analysis?: string | null
          contribution_count?: number
          created_at?: string | null
          date?: string
          day_of_week?: string | null
          ext_id?: string
          file_id?: string | null
          house?: string
          id?: string
          interest_factors?: Json | null
          interest_score?: number | null
          last_updated?: string | null
          location?: string
          next_ext_id?: string | null
          parent_ext_id?: string
          parent_title?: string
          party_count?: Json | null
          prev_ext_id?: string | null
          search_text?: string | null
          search_vector?: unknown | null
          speaker_count?: number
          speakers?: Json | null
          start_time?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      debates_new: {
        Row: {
          analysis: Json | null
          created_at: string | null
          date: string
          ext_id: string
          file_id: string | null
          house: string
          speaker_points: Json | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          analysis?: Json | null
          created_at?: string | null
          date: string
          ext_id: string
          file_id?: string | null
          house: string
          speaker_points?: Json | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          analysis?: Json | null
          created_at?: string | null
          date?: string
          ext_id?: string
          file_id?: string | null
          house?: string
          speaker_points?: Json | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      divisions: {
        Row: {
          ai_context: string | null
          ai_key_arguments: Json | null
          ai_question: string | null
          ai_topic: string | null
          aye_members: Json | null
          ayes_count: number | null
          created_at: string | null
          date: string | null
          debate_section: string | null
          debate_section_ext_id: string
          debate_section_source: string | null
          division_number: string
          evel_ayes_count: number | null
          evel_info: string | null
          evel_noes_count: number | null
          evel_type: number | null
          external_id: string
          has_time: boolean | null
          house: string | null
          is_committee_division: boolean | null
          noe_members: Json | null
          noes_count: number | null
          text_after_vote: string | null
          text_before_vote: string | null
          time: string | null
          updated_at: string | null
        }
        Insert: {
          ai_context?: string | null
          ai_key_arguments?: Json | null
          ai_question?: string | null
          ai_topic?: string | null
          aye_members?: Json | null
          ayes_count?: number | null
          created_at?: string | null
          date?: string | null
          debate_section?: string | null
          debate_section_ext_id: string
          debate_section_source?: string | null
          division_number: string
          evel_ayes_count?: number | null
          evel_info?: string | null
          evel_noes_count?: number | null
          evel_type?: number | null
          external_id: string
          has_time?: boolean | null
          house?: string | null
          is_committee_division?: boolean | null
          noe_members?: Json | null
          noes_count?: number | null
          text_after_vote?: string | null
          text_before_vote?: string | null
          time?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_context?: string | null
          ai_key_arguments?: Json | null
          ai_question?: string | null
          ai_topic?: string | null
          aye_members?: Json | null
          ayes_count?: number | null
          created_at?: string | null
          date?: string | null
          debate_section?: string | null
          debate_section_ext_id?: string
          debate_section_source?: string | null
          division_number?: string
          evel_ayes_count?: number | null
          evel_info?: string | null
          evel_noes_count?: number | null
          evel_type?: number | null
          external_id?: string
          has_time?: boolean | null
          house?: string | null
          is_committee_division?: boolean | null
          noe_members?: Json | null
          noes_count?: number | null
          text_after_vote?: string | null
          text_before_vote?: string | null
          time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_divisions_debates"
            columns: ["debate_section_ext_id"]
            isOneToOne: false
            referencedRelation: "debates"
            referencedColumns: ["ext_id"]
          },
          {
            foreignKeyName: "fk_divisions_debates"
            columns: ["debate_section_ext_id"]
            isOneToOne: false
            referencedRelation: "mp_key_points"
            referencedColumns: ["debate_ext_id"]
          },
        ]
      }
      frontpage_weekly: {
        Row: {
          citations: string[] | null
          created_at: string | null
          highlights: Json | null
          id: string
          is_published: boolean
          remarks: string
          updated_at: string | null
          week_end: string
          week_start: string
          weekday: string | null
        }
        Insert: {
          citations?: string[] | null
          created_at?: string | null
          highlights?: Json | null
          id?: string
          is_published?: boolean
          remarks: string
          updated_at?: string | null
          week_end: string
          week_start: string
          weekday?: string | null
        }
        Update: {
          citations?: string[] | null
          created_at?: string | null
          highlights?: Json | null
          id?: string
          is_published?: boolean
          remarks?: string
          updated_at?: string | null
          week_end?: string
          week_start?: string
          weekday?: string | null
        }
        Relationships: []
      }
      members: {
        Row: {
          age: number | null
          badge_title: string | null
          constituency: string | null
          constituency_country: string | null
          created_at: string
          department: string | null
          display_as: string | null
          email: string | null
          full_title: string | null
          gender: string | null
          house: string | null
          house_end_date: string | null
          house_start_date: string | null
          last_updated_at: string | null
          last_updated_by: string | null
          media: Json | null
          member_id: number
          ministerial_ranking: number | null
          party: string | null
          peerage_type: string | null
          twfy_id: string | null
          twfy_image_url: string | null
          twfy_url: string | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          badge_title?: string | null
          constituency?: string | null
          constituency_country?: string | null
          created_at?: string
          department?: string | null
          display_as?: string | null
          email?: string | null
          full_title?: string | null
          gender?: string | null
          house?: string | null
          house_end_date?: string | null
          house_start_date?: string | null
          last_updated_at?: string | null
          last_updated_by?: string | null
          media?: Json | null
          member_id: number
          ministerial_ranking?: number | null
          party?: string | null
          peerage_type?: string | null
          twfy_id?: string | null
          twfy_image_url?: string | null
          twfy_url?: string | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          badge_title?: string | null
          constituency?: string | null
          constituency_country?: string | null
          created_at?: string
          department?: string | null
          display_as?: string | null
          email?: string | null
          full_title?: string | null
          gender?: string | null
          house?: string | null
          house_end_date?: string | null
          house_start_date?: string | null
          last_updated_at?: string | null
          last_updated_by?: string | null
          media?: Json | null
          member_id?: number
          ministerial_ranking?: number | null
          party?: string | null
          peerage_type?: string | null
          twfy_id?: string | null
          twfy_image_url?: string | null
          twfy_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string | null
          newsletter_frequency: string | null
          postcode: string | null
          selected_topics: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          name?: string | null
          newsletter_frequency?: string | null
          postcode?: string | null
          selected_topics?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          newsletter_frequency?: string | null
          postcode?: string | null
          selected_topics?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reactions_uwhatgov: {
        Row: {
          created_at: string
          debate_id: string
          emoji: string
          id: number
          speech_original_index: number
          user_id: string
        }
        Insert: {
          created_at?: string
          debate_id: string
          emoji: string
          id?: number
          speech_original_index: number
          user_id: string
        }
        Update: {
          created_at?: string
          debate_id?: string
          emoji?: string
          id?: number
          speech_original_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_uwhatgov_debate_id_fkey"
            columns: ["debate_id"]
            isOneToOne: false
            referencedRelation: "casual_debates_uwhatgov"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_calendar_items: {
        Row: {
          created_at: string | null
          date: string | null
          debate_ids: string[] | null
          event_data: Json
          event_id: string
          id: string
          is_active: boolean
          is_unread: boolean
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          debate_ids?: string[] | null
          event_data: Json
          event_id: string
          id?: string
          is_active?: boolean
          is_unread?: boolean
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string | null
          debate_ids?: string[] | null
          event_data?: Json
          event_id?: string
          id?: string
          is_active?: boolean
          is_unread?: boolean
          user_id?: string
        }
        Relationships: []
      }
      saved_debates: {
        Row: {
          created_at: string | null
          date: string
          debate_id: string
          house: string
          id: string
          is_active: boolean
          is_unread: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          debate_id: string
          house: string
          id?: string
          is_active?: boolean
          is_unread?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          debate_id?: string
          house?: string
          id?: string
          is_active?: boolean
          is_unread?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_search_schedules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_run_at: string | null
          next_run_at: string | null
          repeat_on: Json | null
          search_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          repeat_on?: Json | null
          search_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          repeat_on?: Json | null
          search_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_search_schedules_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "saved_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          citations: string[]
          created_at: string
          has_changed: boolean
          id: string
          is_unread: boolean
          query: string
          query_state: Json | null
          response: string
          search_type: string | null
          user_id: string
        }
        Insert: {
          citations: string[]
          created_at?: string
          has_changed?: boolean
          id?: string
          is_unread?: boolean
          query: string
          query_state?: Json | null
          response: string
          search_type?: string | null
          user_id: string
        }
        Update: {
          citations?: string[]
          created_at?: string
          has_changed?: boolean
          id?: string
          is_unread?: boolean
          query?: string
          query_state?: Json | null
          response?: string
          search_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          interests: string[] | null
          name: string | null
          postcode: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          interests?: string[] | null
          name?: string | null
          postcode?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          interests?: string[] | null
          name?: string | null
          postcode?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancel_date: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancel_date?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          cancel_date?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          age: string | null
          ai_chats: Json | null
          ai_searches_count: number | null
          ai_searches_last_reset: string | null
          constituency: string | null
          created_at: string
          email: string | null
          email_verified: boolean | null
          expo_push_token: string | null
          gender: string | null
          hansard_ai_searches_count: number
          id: string
          mp: string | null
          mp_id: number | null
          name: string | null
          newsletter: boolean | null
          newsletter_frequency: string | null
          notify_mp_speeches: boolean | null
          notify_relevant_debates: boolean | null
          organization: string | null
          postcode: string | null
          profile_image_url: string | null
          push_enabled: boolean | null
          role: string | null
          rss_feeds: Json | null
          selected_topics: string[] | null
          updated_at: string
          votes_count: number | null
          votes_last_reset: string | null
        }
        Insert: {
          age?: string | null
          ai_chats?: Json | null
          ai_searches_count?: number | null
          ai_searches_last_reset?: string | null
          constituency?: string | null
          created_at?: string
          email?: string | null
          email_verified?: boolean | null
          expo_push_token?: string | null
          gender?: string | null
          hansard_ai_searches_count?: number
          id: string
          mp?: string | null
          mp_id?: number | null
          name?: string | null
          newsletter?: boolean | null
          newsletter_frequency?: string | null
          notify_mp_speeches?: boolean | null
          notify_relevant_debates?: boolean | null
          organization?: string | null
          postcode?: string | null
          profile_image_url?: string | null
          push_enabled?: boolean | null
          role?: string | null
          rss_feeds?: Json | null
          selected_topics?: string[] | null
          updated_at?: string
          votes_count?: number | null
          votes_last_reset?: string | null
        }
        Update: {
          age?: string | null
          ai_chats?: Json | null
          ai_searches_count?: number | null
          ai_searches_last_reset?: string | null
          constituency?: string | null
          created_at?: string
          email?: string | null
          email_verified?: boolean | null
          expo_push_token?: string | null
          gender?: string | null
          hansard_ai_searches_count?: number
          id?: string
          mp?: string | null
          mp_id?: number | null
          name?: string | null
          newsletter?: boolean | null
          newsletter_frequency?: string | null
          notify_mp_speeches?: boolean | null
          notify_relevant_debates?: boolean | null
          organization?: string | null
          postcode?: string | null
          profile_image_url?: string | null
          push_enabled?: boolean | null
          role?: string | null
          rss_feeds?: Json | null
          selected_topics?: string[] | null
          updated_at?: string
          votes_count?: number | null
          votes_last_reset?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_mp_id_fkey"
            columns: ["mp_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      vector_stores: {
        Row: {
          assistant_id: string | null
          created_at: string | null
          end_date: string
          id: number
          is_active: boolean | null
          start_date: string
          store_id: string
          store_name: string
          updated_at: string | null
        }
        Insert: {
          assistant_id?: string | null
          created_at?: string | null
          end_date: string
          id?: never
          is_active?: boolean | null
          start_date: string
          store_id: string
          store_name: string
          updated_at?: string | null
        }
        Update: {
          assistant_id?: string | null
          created_at?: string | null
          end_date?: string
          id?: never
          is_active?: boolean | null
          start_date?: string
          store_id?: string
          store_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      mp_key_points: {
        Row: {
          ai_summary: string | null
          ai_tone: string | null
          ai_topics: Json | null
          all_key_points: Json | null
          context: string | null
          contribution_count: number | null
          debate_date: string | null
          debate_ext_id: string | null
          debate_house: string | null
          debate_id: string | null
          debate_location: string | null
          debate_title: string | null
          debate_type: string | null
          keywords: Json | null
          member_id: string | null
          opposition: Json | null
          parent_ext_id: string | null
          parent_title: string | null
          party_count: Json | null
          point: string | null
          speaker_constituency: string | null
          speaker_count: number | null
          speaker_full_title: string | null
          speaker_house: string | null
          speaker_name: string | null
          speaker_party: string | null
          speaker_subtopics: Json | null
          support: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      append_ai_chat: {
        Args: { user_id: string; thread_id: string; chat_title: string }
        Returns: undefined
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      clean_speaker_name: {
        Args: { name: string }
        Returns: string
      }
      create_unsubscribe_token: {
        Args: { user_email: string }
        Returns: string
      }
      create_user_with_profile: {
        Args: {
          user_id: string
          user_email: string
          user_organization?: string
          user_role?: string
        }
        Returns: Json
      }
      delete_user: {
        Args: { user_id: string }
        Returns: undefined
      }
      delete_user_account: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      dmetaphone: {
        Args: { "": string }
        Returns: string
      }
      dmetaphone_alt: {
        Args: { "": string }
        Returns: string
      }
      find_previous_debate_date: {
        Args: { start_date: string; debate_types?: string[] }
        Returns: string
      }
      generate_verification_token: {
        Args: { user_email: string }
        Returns: Json
      }
      get_debate_metric_overlaps: {
        Args: Record<PropertyKey, never>
        Returns: {
          word_length_bin: string
          speaker_count_bin: string
          contribution_count_bin: string
          overlap_count: number
        }[]
      }
      get_debate_metrics: {
        Args: Record<PropertyKey, never>
        Returns: {
          category: string
          bin: string
          frequency: number
        }[]
      }
      get_debate_metrics_extended: {
        Args: Record<PropertyKey, never>
        Returns: {
          category: string
          bin: string
          frequency: number
          percentage: number
          rank_in_category: number
        }[]
      }
      get_debate_summary_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          metric: string
          min_value: number
          max_value: number
          avg_value: number
          median_value: number
          total_count: number
        }[]
      }
      get_demographic_vote_stats: {
        Args: { p_debate_id?: string; p_topic?: string; p_days?: number }
        Returns: Json
      }
      get_email_from_token: {
        Args: { verification_token: string }
        Returns: Json
      }
      get_matching_debates: {
        Args: {
          p_members: number[]
          p_members_filter_type: string
          p_parties: string[]
          p_parties_filter_type: string
          p_subtopics: string[]
          p_subtopics_filter_type: string
          p_house: string
          p_debate_types: string[]
          p_days_of_week: string[]
          p_date_from?: string
          p_date_to?: string
        }
        Returns: {
          file_id: string
        }[]
      }
      get_most_recent_debate_date: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_mp_key_points: {
        Args: { p_mp_name: string; p_limit?: number }
        Returns: {
          debate_id: string
          ext_id: string
          debate_title: string
          debate_date: string
          point: string
          point_type: string
          original_speaker: string
          ai_topics: Json
          support: Json
          opposition: Json
          all_key_points: Json
        }[]
      }
      get_previous_debate_date: {
        Args: { input_date: string }
        Returns: string
      }
      get_topic_vote_stats: {
        Args: { p_mp_name?: string }
        Returns: Json
      }
      get_unvoted_debates: {
        Args: {
          p_user_id: string
          p_limit?: number
          p_cursor?: string
          p_cursor_date?: string
          p_cursor_score?: number
          p_type?: string[]
          p_location?: string[]
          p_days?: string[]
          p_topics?: string[]
          p_mp_only?: boolean
          p_divisions_only?: boolean
        }
        Returns: {
          result_id: string
          ai_key_points: Json
          ai_question: string
          ai_question_topic: string
          ai_question_ayes: number
          ai_question_noes: number
          ai_summary: string
          ai_title: string
          ai_tone: string
          ai_topics: Json
          contribution_count: number
          created_at: string
          date: string
          ext_id: string
          house: string
          interest_factors: Json
          interest_score: number
          last_updated: string
          location: string
          next_ext_id: string
          parent_ext_id: string
          parent_title: string
          party_count: Json
          prev_ext_id: string
          search_text: string
          search_vector: unknown
          speaker_count: number
          title: string
          type: string
          divisions: Json
          engagement_score: number
          ai_comment_thread: Json
          speakers: Json
          ai_overview: string
        }[]
      }
      get_unvoted_debates_divisionsonly: {
        Args: { p_user_id: string; p_limit?: number; p_cursor?: string }
        Returns: {
          result_id: string
          ai_key_points: string
          ai_question_1: string
          ai_question_1_ayes: number
          ai_question_1_noes: number
          ai_question_1_topic: string
          ai_question_2: string
          ai_question_2_ayes: number
          ai_question_2_noes: number
          ai_question_2_topic: string
          ai_question_3: string
          ai_question_3_ayes: number
          ai_question_3_noes: number
          ai_question_3_topic: string
          ai_summary: string
          ai_tags: string
          ai_title: string
          ai_tone: string
          ai_topics: string
          contribution_count: number
          created_at: string
          date: string
          ext_id: string
          house: string
          interest_factors: string
          interest_score: number
          last_updated: string
          location: string
          next_ext_id: string
          parent_ext_id: string
          parent_title: string
          party_count: string
          prev_ext_id: string
          search_text: string
          search_vector: unknown
          speaker_count: number
          title: string
          type: string
          divisions: Json
        }[]
      }
      get_unvoted_debates_unauth: {
        Args: {
          p_limit?: number
          p_cursor?: string
          p_cursor_date?: string
          p_cursor_score?: number
          p_ext_id?: string
        }
        Returns: {
          result_id: string
          ai_key_points: string
          ai_question: string
          ai_question_topic: string
          ai_question_ayes: number
          ai_question_noes: number
          ai_summary: string
          ai_title: string
          ai_tone: string
          ai_topics: string
          contribution_count: number
          date: string
          ext_id: string
          interest_factors: string
          interest_score: number
          location: string
          party_count: Json
          speaker_count: number
          title: string
          type: string
          engagement_count: number
          ai_comment_thread: Json
          speakers: Json
          divisions: Json
          ai_overview: string
        }[]
      }
      get_user_id_by_email: {
        Args: { email_param: string }
        Returns: {
          id: string
        }[]
      }
      get_user_topic_votes: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_user_voting_stats: {
        Args: {
          p_user_id: string
          p_start_date: string
          p_end_date: string
          p_interval: string
        }
        Returns: Json
      }
      get_voted_debates: {
        Args: { p_limit: number; p_cursor?: string }
        Returns: {
          id: string
          title: string
          date: string
          type: string
          house: string
          location: string
          ai_title: string
          ai_summary: string
          ai_tone: string
          ai_topics: Json
          ai_tags: Json
          ai_key_points: Json
          ai_question_1: string
          ai_question_1_topic: string
          ai_question_1_ayes: number
          ai_question_1_noes: number
          ai_question_2: string
          ai_question_2_topic: string
          ai_question_2_ayes: number
          ai_question_2_noes: number
          ai_question_3: string
          ai_question_3_topic: string
          ai_question_3_ayes: number
          ai_question_3_noes: number
          speaker_count: number
          contribution_count: number
          party_count: Json
          interest_score: number
          interest_factors: Json
          engagement_count: number
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      match_chunks: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
        }
        Returns: {
          debate_id: string
          chunk_index: number
          similarity: number
          chunk_text: string
        }[]
      }
      migrate_anonymous_votes: {
        Args: { p_votes: Json[] }
        Returns: undefined
      }
      normalize_text: {
        Args: { input: string }
        Returns: string
      }
      notify_mp_speech: {
        Args: {
          user_id: string
          mp_name: string
          topic: string
          debate_id: string
        }
        Returns: string
      }
      notify_relevant_debate: {
        Args: {
          user_id: string
          debate_title: string
          topic: string
          debate_id: string
        }
        Returns: string
      }
      remove_ai_chat: {
        Args: { thread_id: string } | { user_id: string; thread_id: string }
        Returns: undefined
      }
      search_chats: {
        Args: {
          debate_types?: string[]
          search_term?: string
          search_title?: boolean
          search_tag?: boolean
          search_speaker?: boolean
          search_category?: boolean
          last_id?: string
          limit_val?: number
          selected_date?: string
        }
        Returns: {
          id: string
          title: string
          subtitle: string
          speaker_ids: string[]
          speeches: Json
          rewritten_speeches: Json
          analysis: string
          labels: Json
          speechesparallel: boolean
          speaker_names: string[]
          extracts: Json
          proposing_minister: string
          category: string
          debate_type: string
        }[]
      }
      search_chats_alt: {
        Args: {
          debate_types?: string[]
          search_term?: string
          search_title?: boolean
          search_tag?: boolean
          search_speaker?: boolean
          search_category?: boolean
          search_speeches?: boolean
          last_id?: string
          limit_val?: number
          selected_date?: string
          fetch_previous_day?: boolean
        }
        Returns: {
          id: string
          title: string
          subtitle: string
          speaker_ids: string[]
          speeches: Json
          rewritten_speeches: Json
          analysis: string
          topics: string[]
          tags: string[]
          speechesparallel: boolean
          speaker_names: string[]
          extracts: Json
          proposing_minister: string
          category: string
          debate_type: string
        }[]
      }
      search_debate: {
        Args: {
          table_name: string
          debate_type_param: string
          debate_types: string[]
          search_term: string
          search_title: boolean
          search_tag: boolean
          search_speaker: boolean
          search_category: boolean
          search_speeches: boolean
        }
        Returns: {
          id: string
          title: string
          subtitle: string
          speaker_ids: string[]
          speeches: Json
          rewritten_speeches: Json
          analysis: string
          topics: string[]
          tags: string[]
          speechesparallel: boolean
          speaker_names: string[]
          extracts: Json
          proposing_minister: string
          category: string
          debate_type: string
        }[]
      }
      search_debates: {
        Args: {
          search_term?: string
          house_filter?: string
          date_from?: string
          date_to?: string
          member_filter?: string
          party_filter?: string
        }
        Returns: {
          ext_id: string
          title: string
          type: string
          house: string
          date: string
          analysis: Json
          speaker_points: Json
        }[]
      }
      search_member_debates: {
        Args: { p_member_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          debate_id: string
          debate_title: string
          debate_type: string
          debate_house: string
          debate_date: string
          member_name: string
          member_party: string
          member_constituency: string
          member_role: string
          member_contributions: string[]
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      soundex: {
        Args: { "": string }
        Returns: string
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      submit_debate_vote: {
        Args: { p_debate_id: string; p_vote: boolean }
        Returns: undefined
      }
      test_push_notification: {
        Args: { user_id: string; test_title?: string; test_body?: string }
        Returns: Json
      }
      text_soundex: {
        Args: { "": string }
        Returns: string
      }
      update_newsletter_preference: {
        Args: { token_param: string }
        Returns: Json
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      verify_user_email: {
        Args: { token: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
