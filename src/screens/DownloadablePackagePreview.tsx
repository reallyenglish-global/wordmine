import {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {defaultSamplePackageUrl, fetchOnlinePackage} from '../package/download';
import {listOfflinePackages, loadOfflinePackage, removeOfflinePackage, saveOfflinePackage, type OfflinePackageSummary} from '../package/offline-store';
import {PackagePreview} from './PackagePreview';

function sizeLabel(bytes:number) {
  return `${(bytes / 1024).toFixed(bytes < 1024 ? 2 : 1)} KiB`;
}

export function DownloadablePackagePreview({onBack}: {onBack:()=>void}) {
  const [packages,setPackages] = useState<OfflinePackageSummary[]>([]);
  const [activeFiles,setActiveFiles] = useState<Record<string,Uint8Array>|null>(null);
  const [activeKind,setActiveKind] = useState<'online'|'downloaded'|null>(null);
  const [busy,setBusy] = useState(false);
  const [online,setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [storageUnavailable,setStorageUnavailable] = useState(false);
  const [status,setStatus] = useState('');
  const [error,setError] = useState('');
  const source = useMemo(() => () => activeFiles ?? {},[activeFiles]);
  const sampleUrl = useMemo(() => typeof document === 'undefined' ? '' : defaultSamplePackageUrl(document.baseURI),[]);
  const samplePackages = packages.filter(item => item.packageId === 'pack.synthetic-harbor');

  const refresh = useCallback(async () => {
    try { setPackages(await listOfflinePackages()); setStorageUnavailable(false); }
    catch { setStorageUnavailable(true); }
  },[]);
  useEffect(() => {
    let active = true;
    listOfflinePackages().then(items => {if(active){setPackages(items);setStorageUnavailable(false);}})
      .catch(() => {if(active)setStorageUnavailable(true);});
    return () => {active=false;};
  },[]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online',update); window.addEventListener('offline',update);
    return () => {window.removeEventListener('online',update);window.removeEventListener('offline',update);};
  },[]);

  async function studyOnline() {
    setBusy(true); setError(''); setStatus('');
    try {
      const pack = await fetchOnlinePackage(sampleUrl);
      setActiveKind('online'); setActiveFiles(pack.files);
    } catch { setError('Online sample unavailable. Connect and try again.'); }
    finally { setBusy(false); }
  }
  async function downloadSample() {
    setBusy(true); setError(''); setStatus('');
    try {
      const pack = await fetchOnlinePackage(sampleUrl);
      const saved = await saveOfflinePackage(pack);
      setPackages(current => [saved,...current.filter(item => item.key !== saved.key)]);
      setStorageUnavailable(false);
      setStatus('Sample pack downloaded for offline use.');
    } catch { setError('Download failed. No pack was saved.'); }
    finally { setBusy(false); }
  }
  async function openDownloaded(key:string) {
    setBusy(true); setError(''); setStatus('');
    try {
      const pack = await loadOfflinePackage(key);
      if (!pack) throw new Error('not found');
      setActiveKind('downloaded'); setActiveFiles(pack.files);
    } catch { setError('Downloaded sample could not be opened. Remove it and download again.'); }
    finally { setBusy(false); }
  }
  async function removeDownloaded(key:string) {
    setBusy(true); setError(''); setStatus('');
    try {
      await removeOfflinePackage(key);
      setPackages(current => current.filter(item => item.key !== key));
      setStatus('Downloaded sample removed.');
    } catch { setError('Downloaded sample could not be removed.'); }
    finally { setBusy(false); }
  }
  const button = (label:string,action:()=>void,disabled=false) => <Pressable accessibilityRole="button" accessibilityLabel={label}
    disabled={busy||disabled} onPress={action} style={[styles.button,(busy||disabled)&&styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;

  if (activeFiles) return <View style={styles.practice}>
    <Text accessibilityLiveRegion="polite" style={styles.mode}>{activeKind === 'downloaded' ? 'Downloaded sample · available offline' : 'Online sample · not saved as a download'}</Text>
    <PackagePreview onBack={() => {setActiveFiles(null);setActiveKind(null);void refresh();}} source={source}/>
  </View>;

  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.scroll}>
    <View style={styles.content}>
      <Text style={styles.tag}>WORDMINE · WEB PWA PROTOTYPE</Text>
      <Text accessibilityRole="header" style={styles.heading}>Online & offline packages</Text>
      <Text accessibilityLiveRegion="polite" style={styles.note}>{online?'Online: sample package can be fetched.':'Offline: only previously downloaded packages are available.'}</Text>
      <View style={styles.card}>
        <Text style={styles.title}>Synthetic harbour practice</Text>
        <Text style={styles.note}>A sample package served by this web app. Online study fetches it for this session; downloading stores its validated bytes in this browser for offline study.</Text>
        {button('Study sample online',()=>{void studyOnline();},!online)}
        {button('Download sample for offline use',()=>{void downloadSample();},!online)}
      </View>
      {samplePackages.map(item => <View key={item.key} style={styles.card}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.note}>{item.targetLanguage} · version {item.contentVersion} · {sizeLabel(item.totalBytes)}</Text>
        {button('Open downloaded sample',()=>{void openDownloaded(item.key);})}
        {button('Remove downloaded sample',()=>{void removeDownloaded(item.key);})}
        <Text style={styles.footer}>Removing the download removes package bytes; device-local practice progress is retained.</Text>
      </View>)}
      {storageUnavailable&&<Text accessibilityRole="alert" style={styles.note}>Local package storage is unavailable in this browser. Online study remains available.</Text>}
      {!!status&&<Text accessibilityLiveRegion="polite" style={styles.note}>{status}</Text>}
      {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {busy&&<ActivityIndicator accessibilityLabel="Loading word package"/>}
      {button('Back to study',onBack)}
      <Text style={styles.footer}>Synthetic data only. No sign-in, learner account, server-side progress sync, or protected assessment. Integrity checks detect corruption; they do not authenticate a publisher.</Text>
    </View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#141c29'},scroll:{padding:24,paddingVertical:40,alignItems:'center'},
  content:{width:'100%',maxWidth:680,gap:18,padding:4},tag:{color:'#b6c8d8',fontSize:12,letterSpacing:1},
  heading:{color:'#f2eee7',fontSize:32,lineHeight:40,fontWeight:'700'},title:{color:'#f2eee7',fontSize:22,lineHeight:30,fontWeight:'700'},
  note:{color:'#bec9d5',fontSize:15,lineHeight:23},card:{backgroundColor:'#222e3d',borderWidth:1,borderColor:'#344353',borderRadius:24,padding:24,gap:16},
  button:{minHeight:52,backgroundColor:'#304153',borderWidth:1,borderColor:'#4b5f72',borderRadius:12,padding:15,justifyContent:'center'},
  buttonText:{color:'#f7f6f2',fontSize:16,fontWeight:'600'},disabled:{opacity:0.55},footer:{color:'#a8b6c5',fontSize:12,lineHeight:19},
  error:{color:'#ffd5c8',fontSize:15,lineHeight:23},practice:{flex:1,backgroundColor:'#141c29'},mode:{color:'#d7e8c2',fontSize:13,textAlign:'center',padding:10},
});
