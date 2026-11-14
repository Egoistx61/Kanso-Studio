import { LANGUAGE_MAP } from '../data/languages';

export interface CompatibilityGroup {
  id: string;
  label: string;
  languages: string[];
  description: string;
}

export const COMPATIBILITY_GROUPS: CompatibilityGroup[] = [
  {
    id: 'web-sql',
    label: 'Web Runtime + SQLite',
    languages: ['javascript', 'typescript', 'sql'],
    description:
      'TypeScript compiles with esbuild into Node.js alongside JavaScript, and SQL runs in SQLite with structured results passed into JS/TS.',
  },
  {
    id: 'python-sql',
    label: 'Python + SQLite',
    languages: ['python', 'sql'],
    description:
      'SQL executes against a shared SQLite database file (KANSO_DB_PATH) that Python can query directly via its built-in sqlite3 module.',
  },
  {
    id: 'c-cpp',
    label: 'C / C++ Native Pair',
    languages: ['c', 'cpp'],
    description:
      'C and C++ share header/function linkage and execute together in the unified C/C++ runtime.',
  },
  {
    id: 'jvm',
    label: 'JVM Interop Pair',
    languages: ['java', 'kotlin'],
    description:
      'Java and Kotlin share the JVM ecosystem and run together in a unified execution pass.',
  },
];

export interface CompatibilityCheck {
  compatible: boolean;
  reason: string;
  group?: CompatibilityGroup;
  compatibleSuggestions: string[];
}

export function getCompatibleSuggestions(openLanguageIds: string[]): string[] {
  const unique = Array.from(new Set(openLanguageIds));
  if (unique.length === 0) return [];

  const suggestions = new Set<string>();
  for (const group of COMPATIBILITY_GROUPS) {
    if (unique.every((id) => group.languages.includes(id))) {
      for (const langId of group.languages) {
        if (!unique.includes(langId)) {
          suggestions.add(langId);
        }
      }
    }
  }
  return Array.from(suggestions);
}

export function checkLanguageCompatibility(
  openLanguageIds: string[],
  candidateId: string
): CompatibilityCheck {
  const uniqueOpen = Array.from(new Set(openLanguageIds));
  if (uniqueOpen.length === 0 || uniqueOpen.includes(candidateId)) {
    return {
      compatible: true,
      reason: '',
      compatibleSuggestions: getCompatibleSuggestions(uniqueOpen),
    };
  }

  const combined = [...uniqueOpen, candidateId];
  const matchingGroup = COMPATIBILITY_GROUPS.find((group) =>
    combined.every((id) => group.languages.includes(id))
  );

  if (matchingGroup) {
    return {
      compatible: true,
      reason: matchingGroup.description,
      group: matchingGroup,
      compatibleSuggestions: getCompatibleSuggestions(combined),
    };
  }

  const openNames = uniqueOpen
    .map((id) => LANGUAGE_MAP[id]?.name ?? id)
    .join(' + ');
  const candidateName = LANGUAGE_MAP[candidateId]?.name ?? candidateId;
  const suggestions = getCompatibleSuggestions(uniqueOpen);

  const reason =
    suggestions.length > 0
      ? `${candidateName} cannot work together with ${openNames} in the same runtime environment.`
      : `${openNames} runs in an isolated standalone environment and cannot be combined with ${candidateName}.`;

  return {
    compatible: false,
    reason,
    compatibleSuggestions: suggestions,
  };
}
