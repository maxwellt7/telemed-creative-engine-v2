import { db, personas } from './index.js'

const PERSONA_DATA = [
  { name: 'Harold', archetype: 'Skeptical Boomer', demographics: { ageRange: '58-68', gender: 'M' }, psychographics: { trustLevel: 'low', techComfort: 'low' }, primaryFear: "It's not real medicine", primaryCurrency: 'Security' },
  { name: 'Sarah', archetype: 'Busy Mom', demographics: { ageRange: '32-45', gender: 'F' }, psychographics: { trustLevel: 'medium', techComfort: 'medium' }, primaryFear: 'No time for appointments', primaryCurrency: 'Time' },
  { name: 'Marcus', archetype: 'Cost-Conscious Worker', demographics: { ageRange: '40-55', gender: 'M' }, psychographics: { trustLevel: 'medium', techComfort: 'medium' }, primaryFear: "Can't afford this", primaryCurrency: 'Money' },
  { name: 'Emma', archetype: 'Health Anxious Millennial', demographics: { ageRange: '28-38', gender: 'F' }, psychographics: { trustLevel: 'medium', techComfort: 'high' }, primaryFear: "What if it's serious?", primaryCurrency: 'Health' },
  { name: 'Robert', archetype: 'Privacy Protector', demographics: { ageRange: '45-60', gender: 'M' }, psychographics: { trustLevel: 'low', techComfort: 'low' }, primaryFear: 'Who sees my data?', primaryCurrency: 'Security' },
  { name: 'Linda', archetype: 'Already Tried Everything', demographics: { ageRange: '35-50', gender: 'F' }, psychographics: { trustLevel: 'low', techComfort: 'medium' }, primaryFear: 'Nothing works for me', primaryCurrency: 'Hope' },
  { name: 'Derek', archetype: 'High-Performer Executive', demographics: { ageRange: '30-45', gender: 'M' }, psychographics: { trustLevel: 'high', techComfort: 'high' }, primaryFear: "I don't have time to be sick", primaryCurrency: 'Time' },
  { name: 'Ray', archetype: 'Rural Patient', demographics: { ageRange: '40-65', gender: 'neutral' }, psychographics: { trustLevel: 'medium', techComfort: 'low' }, primaryFear: 'No doctors near me', primaryCurrency: 'Access' },
  { name: 'Dorothy', archetype: 'Tech-Averse Senior', demographics: { ageRange: '60-75', gender: 'F' }, psychographics: { trustLevel: 'low', techComfort: 'very_low' }, primaryFear: "I can't figure out the app", primaryCurrency: 'Simplicity' },
  { name: 'Michelle', archetype: 'Weight-Loss Seeker', demographics: { ageRange: '35-55', gender: 'F' }, psychographics: { trustLevel: 'low', techComfort: 'medium' }, primaryFear: "I've failed before", primaryCurrency: 'Confidence' },
  { name: 'Carol', archetype: 'Caregiver', demographics: { ageRange: '40-60', gender: 'F' }, psychographics: { trustLevel: 'medium', techComfort: 'medium' }, primaryFear: 'I need this for someone else', primaryCurrency: 'Reliability' },
  { name: 'James', archetype: 'Embarrassed Patient', demographics: { ageRange: '40-60', gender: 'M' }, psychographics: { trustLevel: 'medium', techComfort: 'medium' }, primaryFear: "I can't say this to a doctor", primaryCurrency: 'Privacy' },
  { name: 'Tina', archetype: 'Insurance-Burnt', demographics: { ageRange: '35-55', gender: 'F' }, psychographics: { trustLevel: 'low', techComfort: 'medium' }, primaryFear: "Insurance won't cover this", primaryCurrency: 'Value' },
  { name: 'Aisha', archetype: 'Social Proof Dependent', demographics: { ageRange: '25-40', gender: 'F' }, psychographics: { trustLevel: 'medium', techComfort: 'high' }, primaryFear: 'I need to see reviews first', primaryCurrency: 'Trust' },
  { name: 'Victor', archetype: 'Urgency Driven', demographics: { ageRange: '30-50', gender: 'neutral' }, psychographics: { trustLevel: 'high', techComfort: 'high' }, primaryFear: 'I need help right now', primaryCurrency: 'Speed' },
]

export async function seedPersonas() {
  const existing = await db.select().from(personas)
  if (existing.length >= 15) {
    console.log('Personas already seeded')
    return
  }
  await db.insert(personas).values(
    PERSONA_DATA.map((p) => ({
      name: p.name,
      archetype: p.archetype,
      demographicsJson: p.demographics,
      psychographicsJson: p.psychographics,
      primaryFear: p.primaryFear,
      primaryCurrency: p.primaryCurrency,
    }))
  )
  console.log('Seeded 15 personas')
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  seedPersonas().then(() => process.exit(0)).catch(console.error)
}
