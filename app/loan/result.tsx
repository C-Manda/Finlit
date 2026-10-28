import { Redirect } from 'expo-router';

// Preserve old links without retaining the retired calculator.
export default function RetiredLoanRoute() {
  return <Redirect href="/learn" />;
}
