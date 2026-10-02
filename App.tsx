import { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import example from './contracts/experimental-v0/meaning-definition.example.json';
import { checkAnswer, parsePrototypeContract } from './src/contract';

const { activity } = parsePrototypeContract(example);

export default function App() {
  const [selected, setSelected] = useState<string | null>(null);
  const correct = selected === null ? null : checkAnswer(activity, selected);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>WORDMINE · EXPERIMENTAL</Text>
        <Text style={styles.heading}>Meaning from definition</Text>
        <Text style={styles.note}>Synthetic offline example. No account, progress sync, or course reporting.</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Choose the matching word</Text>
          <Text style={styles.definition}>{activity.definition}</Text>
          {activity.choices.map((choice) => (
            <Pressable
              key={choice.id}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${choice.label}`}
              onPress={() => setSelected(choice.id)}
              style={[styles.choice, selected === choice.id && styles.selected]}
            >
              <Text style={styles.choiceText}>{choice.label}</Text>
            </Pressable>
          ))}
          {correct !== null && <Text accessibilityRole="alert" style={styles.feedback}>
            {correct ? 'Correct for this sample.' : 'Not this sample; try another choice.'}
          </Text>}
        </View>
        <Text style={styles.footer}>Prototype contract v0 · not a WordMine production exercise</Text>
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
  card: { backgroundColor: '#21324a', borderRadius: 18, padding: 20, gap: 14 },
  label: { color: '#a9c8eb', fontSize: 13, fontWeight: '600' },
  definition: { color: '#fff', fontSize: 21, lineHeight: 29, marginBottom: 8 },
  choice: { backgroundColor: '#344b67', borderRadius: 10, padding: 16 },
  selected: { backgroundColor: '#276c8f' },
  choiceText: { color: '#fff', fontSize: 17 },
  feedback: { color: '#b9e6c4', fontSize: 15, marginTop: 10 },
  footer: { color: '#8ea8c6', fontSize: 12 },
});
