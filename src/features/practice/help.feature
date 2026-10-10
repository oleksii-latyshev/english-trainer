Feature: Graduated answer help
  Scenario: Prepare help without opening it or recording a cue
    Given a spoken question appears
    When its answer plan is prefetched
    Then the help panel stays hidden
    And no help cue is recorded

  Scenario: Open a level only after its cue is saved
    Given a prepared answer plan
    When the learner opens Frame, Phrases, or Example
    Then the cue is recorded before that level appears
    And Example displays the cached model answer immediately

  Scenario: Ignore an answer plan for an old question
    Given help is being prepared for the current question
    When the session, phase, or question changes before it returns
    Then the old plan never replaces help for the new question

  Scenario: Retry unavailable help without blocking speech
    Given help preparation failed
    When the learner retries help
    Then only that explicit retry starts another request
    And the learner can continue speaking while help is unavailable

  Scenario: Finish planning without capture and cancel planning on capture
    Given the Frame is open with a 15 or 30 second timer
    When the timer ends
    Then planning ends without starting the microphone
    When the learner starts capture before the timer ends
    Then planning cancels and capture continues

  Scenario: Hide Example when automatic capture starts
    Given Example is open or its cue acknowledgment is pending
    When Eva finishes speaking and automatic capture starts
    Then Example is hidden
    And a late cue acknowledgment cannot reveal it during capture
