import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Header, Screen } from '@/components/finlit-ui';
import terms from '@/content/glossary.json';
import { useLearningStyles } from '@/components/learning-screens';
export default function Glossary() {
  const s = useLearningStyles();

 const [search,setSearch]=useState('');
 const visible=terms.filter(d=>(d.term+' '+d.meaning).toLowerCase().includes(search.toLowerCase()));
 return <Screen><Header title="Financial glossary" back/><View style={s.stack}><TextInput accessibilityLabel="Search financial terms" placeholder="Search a term" value={search} onChangeText={setSearch} style={[s.card,s.body]}/>{visible.map(d=><View key={d.term} style={s.card}><Text style={s.heading}>{d.term}</Text><Text style={s.body}>{d.meaning}</Text></View>)}{!visible.length&&<Text style={s.body}>No matching terms. Try another word.</Text>}</View></Screen>;
}
