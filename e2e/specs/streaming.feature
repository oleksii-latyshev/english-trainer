Feature: Streaming speech and interruption
  Scenario: Eva speaks while a provider reply is still arriving
    Given an active voice conversation
    When a completed reply sentence arrives before provider completion
    Then Eva starts speaking that sentence
    And the final question is spoken once

  Scenario: Auto-listen waits for the last sentence
    Given auto-listen is enabled and a warm microphone is available
    When an utterance ends while the provider stream remains open
    Then capture does not start
    When the provider and the final utterance finish
    Then auto-listen starts

  Scenario: The learner interrupts a pending reply
    Given Eva is thinking or speaking a streamed reply
    When the learner presses Escape or Speak anyway
    Then the pending reply and playback are cancelled
    And late provider chunks cannot restart speech or persist an answer

  Scenario: Native speech fails
    Given an active voice conversation
    When native speech playback fails
    Then the reply remains on screen with recovery guidance
    And auto-listen does not start

  Scenario: Space is released before interruption finishes
    Given cancellation of a thinking reply has not yet acknowledged
    When the learner releases Space before capture starts
    Then the delayed recording is abandoned
    And no answer or audio is saved
