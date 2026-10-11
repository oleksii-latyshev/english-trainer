Feature: Practice sessions
  Learners can start, continue, and finish a conversation while keeping text input available.

  Scenario: Start with a free topic
    Given the learner selects Free topic without entering a subject
    Then Start talking is disabled
    When the learner enters a subject and chooses a suggested length
    Then Talk opens with those options saved to the session

  Scenario: Recover a failed start or answer
    Given starting a session or sending an answer fails
    Then the learner can retry and the written draft is preserved

  Scenario: Continue an open session
    Given an open session exists
    When the learner selects Continue
    Then Talk restores that session and its saved topic

  Scenario: Write before speaking
    Given the learner starts a Write, then speak session
    When the learner writes and reviews an answer
    Then no microphone capture or speech playback starts
    When Ready to speak succeeds
    Then the original question is replayed and the written answer count stays fixed

  Scenario: Recover a failed transition to speaking
    Given the learner is reviewing written answers
    When moving to speaking fails
    Then the learner stays in Review writing and can retry Ready to speak

  Scenario: Practise recurring mistakes independently of due dates
    Given Memory has a non-archived mistake seen at least twice
    When the learner starts Practice my usual mistakes
    Then five short spoken questions are prepared without opening the microphone yet
    And Talk opens at question one after preparation succeeds

  Scenario: Restore a mistake practice and finish early
    Given the learner has answered two of five mistake-practice questions
    When the app restores the saved session and the learner selects Continue
    Then the same third question and progress are shown
    And Finish remains available without waiting for coaching

  Scenario: Stop at five questions
    Given all five mistake-practice questions have been answered
    Then another answer cannot be recorded or sent
    And pending coaching remains visible when the session finishes
