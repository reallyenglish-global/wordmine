import {useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {syntheticFiles} from '../package/synthetic.generated';
import {encodeUtf8} from '../package/bytes';
import {cardsForList, readPackage, type ContentPackage} from '../package/reader';
import {evaluate, normalizeSpelling} from '../package/evaluate';
import {initialSession, next, packageStorageKey, restore, submit, type PackageSession} from '../package/session';

function bundledFiles() {
  return Object.fromEntries(Object.entries(syntheticFiles).map(([name,data]) =>
    [name,typeof data === 'string' ? encodeUtf8(data) : Uint8Array.from(data)]));
}
export function PackagePreview({onBack,source=bundledFiles}: {onBack:()=>void;source?:()=>Record<string,Uint8Array>}) {
  const loaded = useMemo(() => {
    try {return {content:readPackage(source())};} catch {return {content:null};}
  },[source]);
  if (!loaded.content) return <SafeAreaView style={styles.screen}><View style={styles.content}>
    <Text accessibilityRole="alert" style={styles.heading}>Package could not be opened</Text>
    <Text style={styles.note}>No package was activated. Your existing practice is unchanged.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to study" onPress={onBack} style={styles.button}><Text style={styles.buttonText}>Back to study</Text></Pressable>
  </View></SafeAreaView>;
  return <PackagePractice content={loaded.content} onBack={onBack} source={source}/>;
}
function PackagePractice({content,onBack,source}: {content:ContentPackage;onBack:()=>void;source:()=>Record<string,Uint8Array>}) {
  const list = content.lists[0]; // This bounded preview displays the first list of the bundled synthetic pack.
  const cards = useMemo(() => cardsForList(content,list.id),[content,list.id]);
  const [session,setSession] = useState(() => initialSession(content,list.id));
  const [ready,setReady] = useState(false);
  const [saving,setSaving] = useState(false);
  const [storageError,setStorageError] = useState(false);
  const [answer,setAnswer] = useState('');
  const [rejection,setRejection] = useState('');
  const lock = useRef(false);
  const key = packageStorageKey(content,list.id);
  useEffect(() => {
    let active = true;
    setReady(false);
    AsyncStorage.getItem(key).then(raw => {if(active) setSession(restore(raw,content,list.id));})
      .catch(() => {if(active) setStorageError(true);})
      .finally(() => {if(active) setReady(true);});
    return () => {active=false;};
  },[content,key,list.id]);
  async function save(value:PackageSession) {
    if(lock.current) return;
    lock.current=true; setSession(value); setSaving(true);
    try {await AsyncStorage.setItem(key,JSON.stringify(value));setStorageError(false);}
    catch {setStorageError(true);}
    finally {lock.current=false;setSaving(false);}
  }
  function rejectionExample() {
    const files = source();
    const entry = content.manifest.files.find(f => f.role === 'words')!;
    files[entry.path] = Uint8Array.from(files[entry.path]); files[entry.path][0] ^= 1;
    try {readPackage(files); setRejection('Unexpected validation result. No replacement activated.');}
    catch {setRejection('Invalid package rejected. Current practice unchanged.');}
  }
  const card = cards[session.index];
  const response = card && Object.hasOwn(session.answers,card.id) ? evaluate(card,session.answers[card.id]) : undefined;
  const score = cards.filter(c => Object.hasOwn(session.answers,c.id) && evaluate(c,session.answers[c.id]).correct).length;
  const button = (label:string,action:()=>void,disabled=false) => <Pressable accessibilityRole="button" accessibilityLabel={label}
    disabled={saving||disabled} onPress={action} style={[styles.button,(saving||disabled)&&styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  return <SafeAreaView style={styles.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
    <View style={styles.content}>
      <Text style={styles.tag}>WORDMINE · SYNTHETIC PACKAGE PREVIEW</Text>
      <Text accessibilityRole="header" style={styles.heading}>{!card ? 'Package practice complete' : list.title.text}</Text>
      <Text style={styles.note}>Package {content.manifest.contentVersion} · {content.manifest.languages.target} · manifest {content.manifestHash.slice(0,12)}</Text>
      {!ready ? <ActivityIndicator accessibilityLabel="Loading package practice"/> : !card ? <View style={styles.card}>
        <Text style={styles.title}>{score} of {cards.length} correct</Text>
        {button('Restart package practice',() => {setAnswer('');void save(initialSession(content,list.id));})}
      </View> : <View style={styles.card}>
        <Text style={styles.tag}>Package card {session.index+1} of {cards.length}</Text>
        <Text style={styles.note}>{card.kind === 'meaning-from-definition'?'Choose the matching word':'Spell the word from its meaning'}</Text>
        <Text style={styles.title}>{card.prompt.text}</Text>
        {card.kind === 'meaning-from-definition' ? card.choices.map(choice => <View key={choice.id}>
          {button(`Choose ${choice.label.text}`,() => {void save(submit(session,cards,choice.id));},!!response)}
        </View>) : <>
          <TextInput accessibilityLabel="Package spelling" value={response ? session.answers[card.id] : answer} onChangeText={setAnswer} editable={!response&&!saving} maxLength={16384}
            autoCapitalize="none" autoCorrect={false} spellCheck={false} placeholder="Type the word" placeholderTextColor="#9baabd" style={styles.input}/>
          {!response&&button('Check package spelling',() => {void save(submit(session,cards,answer));},!normalizeSpelling(answer))}
        </>}
        {response&&<>
          <Text accessibilityRole="alert" style={styles.feedback}>{response.correct?'Correct.':`Not quite. Answer: ${card.word}`}</Text>
          {button(session.index===cards.length-1?'Finish package practice':'Next package card',() => {setAnswer('');void save(next(session,cards));})}
        </>}
      </View>}
      {ready&&<Text accessibilityLiveRegion="polite" style={styles.note}>{saving?'Saving package practice…':storageError?'Package storage unavailable. Practice is temporary.':'Package saved on this device'}</Text>}
      {button('Back to study',onBack)}
      {button('Check rejection example',rejectionExample,!ready)}
      {!!rejection&&<Text accessibilityRole="alert" style={styles.note}>{rejection}</Text>}
      <Text style={styles.footer}>Only original synthetic content. Assets are integrity-checked, not rendered. No archive import or network download.</Text>
      <Text style={styles.footer}>Practice on this device only. No course reporting, protected assessment or mastery claim. Original study progress is kept separately.</Text>
    </View>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#141c29'},scroll:{padding:24,paddingVertical:40,alignItems:'center'},
  content:{width:'100%',maxWidth:680,gap:18,padding:4},tag:{color:'#b6c8d8',fontSize:12,letterSpacing:1},
  heading:{color:'#f2eee7',fontSize:32,lineHeight:40,fontWeight:'700'},title:{color:'#f2eee7',fontSize:24,lineHeight:34},
  note:{color:'#bec9d5',fontSize:15,lineHeight:23},card:{backgroundColor:'#222e3d',borderWidth:1,borderColor:'#344353',borderRadius:24,padding:24,gap:16},
  button:{minHeight:52,backgroundColor:'#304153',borderWidth:1,borderColor:'#4b5f72',borderRadius:12,padding:15,justifyContent:'center'},
  buttonText:{color:'#f7f6f2',fontSize:16,fontWeight:'600'},disabled:{opacity:0.55},
  input:{backgroundColor:'#172330',color:'#fff',borderRadius:12,borderWidth:1,borderColor:'#7795ae',minHeight:54,padding:15,fontSize:18},
  feedback:{color:'#d7e8c2',fontSize:16,lineHeight:24},footer:{color:'#a8b6c5',fontSize:12,lineHeight:19},
});
