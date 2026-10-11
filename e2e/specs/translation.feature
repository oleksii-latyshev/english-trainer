Feature: On-demand local word lookup
  Practice stays in English; a selected word can be translated without interrupting it.

  Scenario: Translate a selected word from practice or Memory
    Given a single English word is selected in Talk, coaching notes or Memory
    Then selecting alone makes no translation request
    When the learner explicitly chooses Translate
    Then the word's native-language translation and short English explanation appear
    And no answer is submitted and no speech or microphone action is started

  Scenario: Missing language models
    Given the native translation models are not installed
    When the learner requests a word
    Then an actionable preparation message is shown
    And no download starts until Prepare languages is clicked
    When the learner prepares the models and retries
    Then the translation appears

  Scenario: A closed panel receives a late result
    Given a word translation is pending
    When the learner closes the panel or navigates away
    And the old request finishes
    Then its result does not reopen or replace the current panel

  Scenario: Status failure does not hide a saved language
    Given a persisted native-language choice
    And macOS translation availability cannot be checked
    When Settings opens
    Then the native-language choice remains editable
    And availability can be retried separately
