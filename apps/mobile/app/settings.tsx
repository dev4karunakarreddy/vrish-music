import React from 'react';
import { Linking, NativeModules, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '@noir/theme';

const backgroundPlayback = NativeModules.VrishMetadata as {
  requestBackgroundPlaybackExemption?: () => Promise<boolean>;
} | undefined;

function SettingRow({icon,title,detail,onPress}:{icon:keyof typeof Ionicons.glyphMap;title:string;detail:string;onPress:()=>void}){
  return <Pressable onPress={onPress} accessibilityRole="button" style={{flexDirection:'row',alignItems:'center',paddingVertical:18,borderBottomWidth:1,borderBottomColor:'#242424'}}>
    <Ionicons name={icon} size={21} color="#fff" style={{width:38}}/>
    <View style={{flex:1}}><Text style={{color:'#fff',fontSize:15,fontWeight:'600'}}>{title}</Text><Text style={{color:'#A3A3A3',fontSize:12,lineHeight:18,marginTop:5}}>{detail}</Text></View>
    <Ionicons name="chevron-forward" size={17} color="#777"/>
  </Pressable>;
}

export default function Settings(){
  const router=useRouter();
  const requestExemption=async()=>{
    try{
      const opened=await backgroundPlayback?.requestBackgroundPlaybackExemption?.();
      if(!opened)await Linking.openSettings();
    }catch{await Linking.openSettings();}
  };
  return <ScrollView style={{flex:1,backgroundColor:colors.background}} contentContainerStyle={{padding:24,paddingTop:60,paddingBottom:50}}>
    <Pressable onPress={()=>router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={{width:42,height:42,alignItems:'center',justifyContent:'center',marginBottom:26}}><Ionicons name="chevron-back" size={25} color="#fff"/></Pressable>
    <Text style={{color:'#A3A3A3',fontSize:10,letterSpacing:3,marginBottom:9}}>VRISH MUSIC</Text>
    <Text style={{color:'#fff',fontSize:34,fontWeight:'700',letterSpacing:-1,marginBottom:30}}>Settings</Text>
    <Text style={{color:'#777',fontSize:10,letterSpacing:2,marginBottom:4}}>BACKGROUND PLAYBACK</Text>
    <View style={{padding:17,backgroundColor:'#0D0D0D',borderRadius:12,borderWidth:1,borderColor:'#242424',marginTop:9}}>
      <View style={{flexDirection:'row',alignItems:'center',marginBottom:8}}><Ionicons name="musical-notes" size={17} color="#fff"/><Text style={{color:'#fff',fontWeight:'600',fontSize:14,marginLeft:9}}>Keep music playing</Text></View>
      <Text style={{color:'#A3A3A3',fontSize:13,lineHeight:20}}>VRISH keeps audio in Android’s media playback service while you use other apps. Allow unrestricted battery use so your phone is less likely to stop playback in the background.</Text>
    </View>
    <SettingRow icon="battery-charging-outline" title="Allow unrestricted battery use" detail="Show Android’s battery exemption prompt for reliable background playback." onPress={()=>void requestExemption()}/>
    <SettingRow icon="settings-outline" title="OnePlus background activity" detail="In app info, allow auto launch and background activity, and set battery use to Unrestricted." onPress={()=>void Linking.openSettings()}/>
    <Text style={{color:'#666',fontSize:12,lineHeight:18,marginTop:15}}>OnePlus may apply additional background limits. Keep VRISH’s playback notification active while music is playing.</Text>
  </ScrollView>;
}
