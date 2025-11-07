/**
 * AI Mediator Enums
 *
 * Enumerations for AI Mediator integration.
 * Used for AI mediator queries, validation, and data filtering.
 */

/**
 * AI Query Type
 *
 * Defines the type of AI query being processed.
 */
export enum AIQueryType {
  /**
   * Academic queries - related to learning, lessons, and educational content
   * Examples: "Explain photosynthesis", "Help with math problem"
   */
  ACADEMIC = 'academic',

  /**
   * Analytics queries - related to data analysis and reporting
   * Examples: "What is the average performance of grade 4?", "Show attendance trends"
   */
  ANALYTICS = 'analytics',

  /**
   * General queries - other types of queries
   * Examples: "What is my schedule?", "When is the next exam?"
   */
  GENERAL = 'general',
}

/**
 * AI Query Status
 *
 * Status of an AI query processing.
 */
export enum AIQueryStatus {
  /**
   * Query is pending validation
   */
  PENDING = 'pending',

  /**
   * Query passed validation and is being processed
   */
  PROCESSING = 'processing',

  /**
   * Query completed successfully
   */
  COMPLETED = 'completed',

  /**
   * Query failed validation
   */
  REJECTED = 'rejected',

  /**
   * Query processing failed with an error
   */
  ERROR = 'error',
}

/**
 * AI Data Filter Mode
 *
 * Defines how data filtering should be applied.
 */
export enum AIDataFilterMode {
  /**
   * Strict filtering - only allow explicitly permitted data
   */
  STRICT = 'strict',

  /**
   * Moderate filtering - allow data within user's access scope
   */
  MODERATE = 'moderate',

  /**
   * Permissive filtering - allow data based on clearance level only
   */
  PERMISSIVE = 'permissive',
}

