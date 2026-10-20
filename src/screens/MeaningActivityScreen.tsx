import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ActivityDocument, ActivityOutcome, Grader, MeaningFromDefinitionActivity } from '../contract';

type Props = { document: ActivityDocument & { activity: MeaningFromDefinitionActivity }; grader: Grader };

/** Select a choice, submit it, read feedback, optionally try again. Grading goes through the `Grader` seam. */
export function MeaningActivityScreen({ document, grader }: Props) {
  const { activity } = document;
  const [selected, setSelected] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ActivityOutcome | null>(null);
  const submitted = outcome !== null;

  const submit = () => {
    if (selected === null) return;
    setOutcome(grader.grade(activity, { type: 'submit-choice', activityId: activity.id, choiceId: selected }));
  };
  const reset = () => {
    setSelected(null);
    setOutcome(null);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label} accessibilityLanguage={activity.instruction?.lang}>
        {activity.instruction?.text ?? 'Choose the matching word'}
      </Text>
      <Text style={styles.prompt} accessibilityLanguage={activity.prompt.lang}>
        {activity.prompt.text}
      </Text>
      <View accessibilityRole="radiogroup" style={styles.choices}>
        {activity.choices.map((choice) => {
          const isSelected = selected === choice.id;
          const isAnswer = submitted && outcome.answerChoiceId === choice.id;
          return (
            <Pressable
              key={choice.id}
              accessibilityRole="radio"
              accessibilityLabel={choice.label.text}
              accessibilityState={{ checked: isSelected, disabled: submitted }}
              disabled={submitted}
              onPress={() => setSelected(choice.id)}
              style={[styles.choice, isSelected && styles.choiceSelected, isAnswer && styles.choiceAnswer]}
            >
              <Text style={styles.choiceText} accessibilityLanguage={choice.label.lang}>
                {choice.label.text}
              </Text>
              {isSelected && !submitted && <Text style={styles.choiceMark}>Selected</Text>}
              {isAnswer && <Text style={styles.choiceMark}>Answer</Text>}
            </Pressable>
          );
        })}
      </View>
      {!submitted && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: selected === null }}
          disabled={selected === null}
          onPress={submit}
          style={[styles.button, selected === null && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>Check answer</Text>
        </Pressable>
      )}
      {submitted && (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.feedback, outcome.status === 'correct' ? styles.feedbackCorrect : styles.feedbackIncorrect]}
        >
          <Text style={styles.feedbackTitle}>{outcome.status === 'correct' ? '✓ Correct' : '✗ Not quite'}</Text>
          {outcome.feedback && (
            <Text style={styles.feedbackText} accessibilityLanguage={outcome.feedback.lang}>
              {outcome.feedback.text}
            </Text>
          )}
          <Pressable accessibilityRole="button" onPress={reset} style={styles.buttonSecondary}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#21324a', borderRadius: 18, padding: 20, gap: 14 },
  label: { color: '#a9c8eb', fontSize: 13, fontWeight: '600' },
  prompt: { color: '#fff', fontSize: 21, lineHeight: 29, marginBottom: 8 },
  choices: { gap: 10 },
  choice: { backgroundColor: '#344b67', borderRadius: 10, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  choiceSelected: { backgroundColor: '#276c8f', borderColor: '#9dc9ff' },
  choiceAnswer: { borderColor: '#b9e6c4' },
  choiceText: { color: '#fff', fontSize: 17 },
  choiceMark: { color: '#dbe9ff', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  button: { backgroundColor: '#3b82c4', borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.45 },
  buttonSecondary: { backgroundColor: '#344b67', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  feedback: { borderRadius: 12, padding: 14, gap: 8, borderLeftWidth: 5 },
  feedbackCorrect: { backgroundColor: '#1f3d2d', borderLeftColor: '#b9e6c4' },
  feedbackIncorrect: { backgroundColor: '#3d2e1f', borderLeftColor: '#ffd6a5' },
  feedbackTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  feedbackText: { color: '#e6eef8', fontSize: 15, lineHeight: 22 },
});
