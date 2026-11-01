import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { buildCards, parsePack } from './src/study/pack';
import { advance, createSession, restoreSession, storageKey, submitAnswer, type Session } from './src/study/session';
import sample from './src/study/synthetic-en.json';
import { ContractPreview } from './src/screens/ContractPreview';
import { PackagePreview } from './src/screens/PackagePreview';
import { DownloadablePackagePreview } from './src/screens/DownloadablePackagePreview';

const pack = parsePack(sample);
const cards = buildCards(pack);

function StudyApp() {
  const [contractDemo, setContractDemo] = useState(false);
  const [packageDemo, setPackageDemo] = useState(false);
  const [downloadDemo, setDownloadDemo] = useState(false);
  const [session, setSession] = useState(() => createSession(pack));
  const [ready, setReady] = useState(false);
  const [studying, setStudying] = useState(false);
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const writeLock = useRef(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey(pack)).then(raw => {
      if (active) setSession(restoreSession(raw, pack));
    }).catch(() => { if (active) setStorageError(true); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  async function save(next: Session) {
    if (writeLock.current) return;
    writeLock.current = true;
    setSaving(true); setSession(next);
    try { await AsyncStorage.setItem(storageKey(pack), JSON.stringify(next)); setStorageError(false); }
    catch { setStorageError(true); }
    finally { writeLock.current = false; setSaving(false); }
  }
  const card = cards[session.index];
  const result = card ? session.results[card.id] : undefined;
  const complete = session.index === cards.length;
  const score = Object.values(session.results).filter(r => r.correct).length;
  const button = (label: string, onPress: () => void, secondary = false, disabled = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled || saving}
      onPress={onPress} style={[styles.button, secondary && styles.secondary, (disabled || saving) && styles.disabled]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
  if (contractDemo) return <ContractPreview onBack={() => setContractDemo(false)} />;
  if (packageDemo) return <PackagePreview onBack={() => setPackageDemo(false)} />;
  if (downloadDemo) return <DownloadablePackagePreview onBack={() => setDownloadDemo(false)} />;
  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <View style={styles.header}><Text style={styles.brand}>wordmine</Text><Text style={styles.tag}>NEXT · LOCAL PREVIEW</Text></View>
        <Text style={styles.eyebrow}>A LITTLE PRACTICE. A WIDER WORLD.</Text>
        <Text accessibilityRole="header" style={styles.heading}>{studying ? (complete ? 'Practice complete' : 'Find the right words.') : 'Make words your own.'}</Text>
        <Text style={styles.note}>A quiet space for recognition and recall — no account needed.</Text>
        {!ready ? <ActivityIndicator accessibilityLabel="Loading local practice" color="#a7cfff" /> : !studying ? <View style={styles.card}>
          <Text style={styles.tag}>ENGLISH · SYNTHETIC SAMPLE</Text>
          <Text style={styles.title}>{pack.title}</Text>
          <Text style={styles.note}>3 words · 6 cards · meaning choice + spelling recall</Text>
          <Text style={styles.note}>{pack.provenance}</Text>
          {button(session.index > 0 || Object.keys(session.results).length ? 'Resume practice' : 'Start practice', () => setStudying(true))}
        </View> : complete ? <View style={styles.card}>
          <Text style={styles.title}>{score} of {cards.length} correct</Text>
          <Text style={styles.note}>Recognition and recall are different kinds of practice. This sample is not an assessment of long-term learning.</Text>
          {button('Practice again', () => { setAnswer(''); void save(createSession(pack)); })}
          {button('Back to packs', () => setStudying(false), true)}
        </View> : <View style={styles.card}>
          <View style={styles.header}><Text style={styles.tag}>{card.kind === 'meaning-choice' ? 'RECOGNITION' : 'RECALL'}</Text><Text style={styles.note}>Card {session.index + 1} of {cards.length}</Text></View>
          <View style={styles.track}><View style={[styles.progress, { width: `${session.index / cards.length * 100}%` }]} /></View>
          <Text style={styles.label}>{card.kind === 'meaning-choice' ? 'Choose the matching word' : 'Spell the word from its meaning'}</Text>
          <Text style={styles.definition}>{card.prompt}</Text>
          {card.kind === 'meaning-choice' ? card.choices.map(choice => <View key={choice.id}>
            {button(`Choose ${choice.label}`, () => { void save(submitAnswer(session, cards, choice.id)); }, true, !!result)}
          </View>) : <>
            <TextInput accessibilityLabel="Your spelling" value={answer} onChangeText={setAnswer} editable={!result && !saving}
              autoCapitalize="none" autoCorrect={false} spellCheck={false} placeholder="Type the word" placeholderTextColor="#9baabd"
              onSubmitEditing={() => { if (!result) void save(submitAnswer(session, cards, answer)); }} style={styles.input} />
            {!result && button('Check spelling', () => { void save(submitAnswer(session, cards, answer)); }, false, !answer.trim())}
          </>}
          {!!result && <>
            <Text accessibilityRole="alert" style={styles.feedback}>{result.correct ? 'Correct.' : `Not quite. Answer: ${card.word}`}</Text>
            {button(session.index === cards.length - 1 ? 'Finish practice' : 'Next card', () => { setAnswer(''); void save(advance(session, cards)); })}
          </>}
          {button('Back to packs', () => setStudying(false), true)}
        </View>}
        {ready && !studying && button('Explore contract demo', () => setContractDemo(true), true)}
        {ready && !studying && button('Explore package demo', () => setPackageDemo(true), true)}
        {ready && !studying && Platform.OS === 'web' && button('Explore online and offline packs', () => setDownloadDemo(true), true)}
        {ready && <Text accessibilityLiveRegion="polite" style={styles.footer}>{saving ? 'Saving…' : storageError ? 'Storage unavailable. Practice is temporary until a save succeeds.' : 'Saved on this device'}</Text>}
        <Text style={styles.footer}>Practice on this device only. No course reporting or mastery claim.</Text>
        <Text style={styles.footer}>Original synthetic content · pack {pack.version} · preview, not a production course</Text>
      </View>
    </ScrollView><StatusBar style="light" />
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><StudyApp /></SafeAreaProvider>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#141c29' },
  scroll: { flexGrow: 1, padding: 24, paddingVertical: 40, alignItems: 'center' },
  content: { width: '100%', maxWidth: 680, gap: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  brand: { color: '#f2eee7', fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  tag: { color: '#b6c8d8', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  eyebrow: { color: '#b2cba9', fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginTop: 28 },
  heading: { color: '#f2eee7', fontSize: 36, lineHeight: 43, fontWeight: '700', letterSpacing: -1 },
  title: { color: '#f2eee7', fontSize: 25, fontWeight: '700' },
  note: { color: '#bec9d5', fontSize: 15, lineHeight: 23 },
  card: { backgroundColor: '#222e3d', borderColor: '#344353', borderWidth: 1, borderRadius: 24, padding: 24, gap: 16, marginTop: 8 },
  label: { color: '#c4d2df', fontSize: 14, lineHeight: 22 },
  definition: { color: '#f2eee7', fontSize: 24, lineHeight: 34, marginBottom: 10 },
  button: { minHeight: 52, justifyContent: 'center', backgroundColor: '#395d55', borderRadius: 12, padding: 15 },
  secondary: { backgroundColor: '#304153', borderWidth: 1, borderColor: '#4b5f72' },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#f7f6f2', fontSize: 16, fontWeight: '600' },
  input: { backgroundColor: '#172330', color: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#7795ae', minHeight: 54, padding: 15, fontSize: 18 },
  feedback: { color: '#d7e8c2', fontSize: 16, lineHeight: 24 },
  footer: { color: '#a8b6c5', fontSize: 12, lineHeight: 19 },
  track: { height: 4, backgroundColor: '#3d4c5e', borderRadius: 4 },
  progress: { height: 4, backgroundColor: '#aac99d', borderRadius: 4 },
});
