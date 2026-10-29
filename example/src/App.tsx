import { useState } from 'react';
import { Text, View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { runFileChecks } from './runFileChecks';

export default function App() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  async function run() {
    if (running) return;
    setRunning(true);
    setResults([]);
    try {
      setResults(await runFileChecks());
    } catch (error) {
      setResults([
        `失败：${error instanceof Error ? error.message : String(error)}`,
      ]);
    } finally {
      setRunning(false);
    }
  }
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Unif Files</Text>
      <Text>
        在本应用专用示例目录验证文件操作、回环服务与下载，结束后清理示例文件。
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: running }}
        disabled={running}
        onPress={run}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {running ? '验证中…' : '运行原生验证'}
        </Text>
      </Pressable>
      <View accessibilityLiveRegion="polite">
        {results.map((result) => (
          <Text key={result} style={styles.result}>
            {result}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 72,
    gap: 20,
  },
  title: { fontSize: 28, fontWeight: 'bold' },
  button: { backgroundColor: '#1264a3', padding: 16, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 17, textAlign: 'center' },
  result: { fontSize: 16, marginBottom: 12 },
});
