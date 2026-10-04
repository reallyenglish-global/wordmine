import { useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import synthetic from './contracts/experimental-v0/fixtures/valid/meaning-definition.synthetic.json';
import { LocalAnswerKeyGrader } from './src/contract';
import { BundledFixtureSource } from './src/content/source';
import { useActivityDocument } from './src/content/useActivityDocument';
import { MeaningActivityScreen } from './src/screens/MeaningActivityScreen';

export default function App() {
  const source = useMemo(() => new BundledFixtureSource(synthetic), []);
  const state = useActivityDocument(source);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>WORDMINE · EXPERIMENTAL</Text>
        <Text style={styles.heading}>Meaning from definition</Text>
        <Text style={styles.note}>Synthetic offline example. No account, progress sync, or course reporting.</Text>
        {state.status === 'loading' && <Text style={styles.note}>Loading activity…</Text>}
        {state.status === 'error' && (
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not load the activity</Text>
            <Text style={styles.note}>{state.message}</Text>
            {state.issues.map((issue) => (
              <Text key={issue.path} style={styles.issue}>
                {issue.path}: {issue.message}
              </Text>
            ))}
          </View>
        )}
        {state.status === 'ready' && state.document.answerKey && (
          <MeaningActivityScreen document={state.document} grader={new LocalAnswerKeyGrader(state.document.answerKey)} />
        )}
        {state.status === 'ready' && !state.document.answerKey && (
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.errorTitle}>This document has no local answer key</Text>
            <Text style={styles.note}>Prompt-only documents need a server-side grader, which this prototype does not have.</Text>
          </View>
        )}
        <Text style={styles.footer}>Contract wordmine.activity.v0 · not a WordMine production exercise</Text>
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121d30' },
  content: { padding: 24, paddingTop: 72, gap: 18 },
  eyebrow: { color: '#9dc9ff', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  heading: { color: '#f4f8ff', fontSize: 30, fontWeight: '700' },
  note: { color: '#b4c4d9', fontSize: 15, lineHeight: 23 },
  errorCard: { backgroundColor: '#3d2e1f', borderRadius: 18, padding: 20, gap: 8, borderLeftWidth: 5, borderLeftColor: '#ffd6a5' },
  errorTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  issue: { color: '#ffd6a5', fontSize: 13, fontFamily: 'monospace' },
  footer: { color: '#8ea8c6', fontSize: 12 },
});
