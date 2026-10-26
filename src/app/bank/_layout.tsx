import { Tabs } from 'expo-router';

import { FnKey, fnTabBarStyle } from '@/components/fn-tabs';
import { Frame } from '@/components/system-bar';
import { color } from '@/theme/tokens';

const key = (n: number, label: string) => ({
  tabBarIcon: ({ focused }: { focused: boolean }) => (
    <FnKey n={n} label={label} focused={focused} tone={color.accent} />
  ),
});

export default function BankLayout() {
  return (
    <Frame>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: fnTabBarStyle(color.accent),
        }}>
        <Tabs.Screen name="index" options={key(1, 'HOME')} />
        <Tabs.Screen name="log" options={key(2, 'LOG')} />
        <Tabs.Screen name="budgets" options={key(3, 'PLAN')} />
        <Tabs.Screen name="goals" options={key(4, 'GOALS')} />
        <Tabs.Screen name="advisor" options={key(5, 'ADVISOR')} />
      </Tabs>
    </Frame>
  );
}
