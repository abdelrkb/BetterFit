import { Stack } from 'expo-router';

/**
 * Les écrans de l'app une fois connecté.
 *
 * Une pile qui contient les **onglets**, plus les écrans qui n'en sont pas :
 * bibliothèque d'exercices, séance en cours, espace coach, démo.
 *
 * Ils ne sont volontairement **pas** dans le navigateur d'onglets. Les y
 * mettre en les masquant par `href: null` les rendait purement et simplement
 * inatteignables : la séance guidée, l'historique, les exercices et l'espace
 * coach renvoyaient tous sur l'accueil. Une pile à côté des onglets est la
 * structure attendue, et elle a un avantage : la séance guidée occupe tout
 * l'écran, sans barre d'onglets sous le pouce.
 */
export default function MainLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
