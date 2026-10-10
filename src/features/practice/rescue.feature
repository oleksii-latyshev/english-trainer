Feature: Stuck rescue during a spoken answer

  Scenario: Open help without ending the live answer
    Given a normal spoken question is recording
    When the learner presses Stuck or the S shortcut
    Then the app snapshots the recent speech and asks for a next step
    And the microphone keeps recording with the turn held open

  Scenario: Help never blocks stopping or cancelling
    Given rescue help is loading during recording
    When the learner stops or cancels the microphone
    Then the rescue result is discarded
    And the recording follows its normal stop or cancel behavior

  Scenario: Ignore a response for an earlier capture or question
    Given a rescue request is in flight
    When the recording, session phase, sequence, or question changes
    Then the late response is not shown
    And the old rescue hold is released without affecting a newer recording

  Scenario: Find and select a missing word
    Given the learner opens Missing word during recording
    When they describe the word in English and request suggestions
    Then the app shows three to five candidate terms
    When they choose one candidate
    Then only the selected term is shown without changing or sending the answer

  Scenario: Recover from a rescue error
    Given a rescue request fails
    Then a concise error and Retry action appear
    And the microphone remains usable
    When the learner retries
    Then the current rescue mode and word description are preserved

  Scenario: Release the rescue hold when help closes
    Given rescue help has held the live turn open
    When the learner chooses Continue speaking or leaves the recording
    Then rescue releases only its own hold
    And any hold the learner already set remains in effect
