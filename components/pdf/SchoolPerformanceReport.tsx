'use client'

import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, Image,
} from '@react-pdf/renderer'

const PRIMARY_EMERALD = '#042f1a'
const SECONDARY_GOLD = '#b45309'
const IVORY_TINT = '#fafaf9'
const TEXT_DARK = '#1e293b'
const TEXT_MUTED = '#64748b'
const BORDER_LIGHT = '#e2e8f0'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    padding: 24,
    fontSize: 9,
    color: TEXT_DARK,
    backgroundColor: IVORY_TINT,
    position: 'relative',
  },
  pageBorder: {
    position: 'absolute',
    top: 10, left: 10, right: 10, bottom: 10,
    borderWidth: 1, borderStyle: 'solid', borderColor: '#d97706',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: PRIMARY_EMERALD,
    paddingBottom: 8, marginBottom: 10,
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 38, height: 38 },
  schoolName: { fontSize: 14, fontWeight: 'bold', color: PRIMARY_EMERALD },
  schoolSubtitle: { fontSize: 8, color: SECONDARY_GOLD, marginTop: 1, textTransform: 'uppercase' },
  reportMeta: { textAlign: 'right' },
  reportTitle: { fontSize: 10, fontWeight: 'bold', color: PRIMARY_EMERALD, textTransform: 'uppercase' },
  reportSub: { fontSize: 8, color: TEXT_MUTED, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  statCard: {
    flex: 1, backgroundColor: '#ffffff',
    borderWidth: 1, borderStyle: 'solid', borderColor: BORDER_LIGHT,
    borderRadius: 8, padding: 8, alignItems: 'center', justifyContent: 'center',
  },
  statVal: { fontSize: 14, fontWeight: 'bold', color: PRIMARY_EMERALD },
  statLbl: { fontSize: 7, color: TEXT_MUTED, marginTop: 2, textAlign: 'center', textTransform: 'uppercase' },
  sectionTitle: {
    fontSize: 9, fontWeight: 'bold', color: PRIMARY_EMERALD,
    textTransform: 'uppercase', borderBottomWidth: 1, borderBottomStyle: 'solid',
    borderBottomColor: PRIMARY_EMERALD, paddingBottom: 2, marginBottom: 4, marginTop: 2,
  },
  narrativeBox: {
    backgroundColor: '#f0fdf4', borderWidth: 1, borderStyle: 'solid', borderColor: '#bbf7d0',
    borderRadius: 8, padding: 8, marginBottom: 8,
  },
  narrativeText: { fontSize: 8.5, lineHeight: 1.4, color: PRIMARY_EMERALD },
  tableContainer: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  tableWrapper: { flex: 1, borderWidth: 1, borderStyle: 'solid', borderColor: BORDER_LIGHT, borderRadius: 6, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: PRIMARY_EMERALD, padding: 4 },
  th: { color: '#ffffff', fontSize: 7.5, fontWeight: 'bold', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', padding: 4, borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: BORDER_LIGHT },
  tableRowAlt: { flexDirection: 'row', padding: 4, borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: BORDER_LIGHT, backgroundColor: '#f8fafc' },
  td: { fontSize: 7.5, color: TEXT_DARK },
  signatureSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, paddingHorizontal: 10 },
  sigBox: { width: '28%', alignItems: 'center' },
  sigLine: { borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: TEXT_DARK, width: '100%', paddingTop: 4, marginTop: 24, fontSize: 7.5, textAlign: 'center', fontWeight: 'bold' },
  sigTitle: { fontSize: 6.5, color: TEXT_MUTED, marginTop: 1 },
  stampBox: { width: '28%', alignItems: 'center', justifyContent: 'center' },
  stampCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderStyle: 'solid', borderColor: SECONDARY_GOLD, alignItems: 'center', justifyContent: 'center', padding: 4 },
  stampText: { fontSize: 6, color: SECONDARY_GOLD, textAlign: 'center', fontWeight: 'bold' },
  footer: {
    position: 'absolute', bottom: 16, left: 24, right: 24,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: BORDER_LIGHT, paddingTop: 4,
  },
  footerText: { fontSize: 6.5, color: TEXT_MUTED },
})

function getSchoolBadge(classes: any[], target: number) {
  const safeClasses = Array.isArray(classes) ? classes : []
  const onTarget = safeClasses.filter(c => (c.avg_safhas || 0) >= target).length
  const ratio = safeClasses.length ? onTarget / safeClasses.length : 1
  if (ratio >= 0.75) return { label: 'SCHOOL OF EXCELLENCE', bg: '#dcfce7', color: '#15803d' }
  if (ratio >= 0.5) return { label: 'HEALTHY / ACTIVE PROGRESS', bg: '#fef9c3', color: '#a16207' }
  return { label: 'CRITICAL ATTENTION NEEDED', bg: '#fee2e2', color: '#b91c1c' }
}

export const SchoolPerformanceReportPDF = ({
  principalName = 'Principal',
  classes = [],
  atRiskStudents = [],
  termName = '',
  currentWeek = 1,
  totalStudents = 0,
  isEndOfTerm = false,
}: any) => {
  const safeClasses = Array.isArray(classes) ? classes : []
  const safeRisk = Array.isArray(atRiskStudents) ? atRiskStudents : []
  const targetSafhas = 6
  const badge = getSchoolBadge(safeClasses, targetSafhas)
  const avgSchool = safeClasses.length
    ? (safeClasses.reduce((a: number, c: any) => a + (c.avg_safhas || 0), 0) / safeClasses.length).toFixed(1)
    : '0.0'
  const classesOnTarget = safeClasses.filter((c: any) => (c.avg_safhas || 0) >= targetSafhas).length

  const logoUrl = typeof window !== 'undefined' ? `${window.location.origin}/logo/logo.png` : '/logo/logo.png'
  const narrative = `Official assessment audit of El-Kanemi College Quranic memorisation indices. Out of ${safeClasses.length} active classrooms comprising ${totalStudents} enrolled pupils, the comprehensive school-wide average has settled at ${avgSchool} Safhas per week. A total of ${classesOnTarget} classes are strictly satisfying the target thresholds. There are currently ${safeRisk.length} student files marked under clinical focus as requiring close intervention.`

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.pageBorder} />

        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image src={logoUrl} style={styles.logo} />
            <View>
              <Text style={styles.schoolName}>El-Kanemi College</Text>
              <Text style={styles.schoolSubtitle}>Office of the Principal & Academic Board</Text>
            </View>
          </View>
          <View style={styles.reportMeta}>
            <Text style={styles.reportTitle}>{isEndOfTerm ? 'End of Term Assessment' : 'Weekly Performance Audit'}</Text>
            <Text style={styles.reportSub}>{termName || 'Academic Term'} — W{currentWeek}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{totalStudents}</Text>
            <Text style={styles.statLbl}>Total Pupils</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{safeClasses.length}</Text>
            <Text style={styles.statLbl}>Active Classes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{avgSchool}</Text>
            <Text style={styles.statLbl}>School Avg</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{classesOnTarget}</Text>
            <Text style={styles.statLbl}>Classes on target</Text>
          </View>
          <View style={[styles.statCard, { borderLeftWidth: 3, borderLeftColor: SECONDARY_GOLD }]}>
            <Text style={styles.statVal}>{safeRisk.length}</Text>
            <Text style={styles.statLbl}>At-risk pupils</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Executive Performance Brief</Text>
        <View style={styles.narrativeBox}>
          <Text style={styles.narrativeText}>{narrative}</Text>
        </View>

        <View style={styles.tableContainer}>
          <View style={styles.tableWrapper}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: '15%' }]}>Rank</Text>
              <Text style={[styles.th, { width: '55%' }]}>Classroom</Text>
              <Text style={[styles.th, { width: '30%' }]}>Avg Safhas</Text>
            </View>
            {safeClasses.slice(0, 7).map((c: any, i: number) => (
              <View key={c.class_id || i} style={i % 2 === 1 ? styles.tableRowAlt : styles.tableRow}>
                <Text style={[styles.td, { width: '15%', fontWeight: 'bold' }]}>#{i + 1}</Text>
                <Text style={[styles.td, { width: '55%', fontWeight: 'bold' }]}>{c.display_name_en}</Text>
                <Text style={[styles.td, { width: '30%', color: SECONDARY_GOLD, fontWeight: 'bold' }]}>{c.avg_safhas?.toFixed(1) || '0.0'}</Text>
              </View>
            ))}
          </View>

          <View style={styles.tableWrapper}>
            <View style={[styles.tableHeader, { backgroundColor: '#7f1d1d' }]}>
              <Text style={[styles.th, { width: '50%' }]}>Pupil Name</Text>
              <Text style={[styles.th, { width: '35%' }]}>Class</Text>
              <Text style={[styles.th, { width: '15%' }]}>Wks</Text>
            </View>
            {safeRisk.slice(0, 7).map((s: any, i: number) => (
              <View key={s.student_id || i} style={i % 2 === 1 ? styles.tableRowAlt : styles.tableRow}>
                <Text style={[styles.td, { width: '50%', fontWeight: 'bold' }]}>{s.full_name}</Text>
                <Text style={[styles.td, { width: '35%' }]}>{s.class_name}</Text>
                <Text style={[styles.td, { width: '15%', color: '#ef4444', fontWeight: 'bold' }]}>{s.red_weeks} red</Text>
              </View>
            ))}
            {safeRisk.length === 0 && (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 8, color: '#15803d', fontWeight: 'bold' }}>All school records healthy</Text>
              </View>
            )}
          </View>
        </View>

        <View style={[{ padding: 6, borderRadius: 6, alignItems: 'center', marginBottom: 10 }, { backgroundColor: badge.bg }]}>
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: badge.color }}>{badge.label}</Text>
        </View>

        <View style={styles.signatureSection}>
          <View style={styles.sigBox}>
            <Text style={styles.sigLine}>{principalName || 'Principal'}</Text>
            <Text style={styles.sigTitle}>Primary Academy Principal</Text>
          </View>
          <View style={styles.stampBox}>
            <View style={styles.stampCircle}>
              <Text style={styles.stampText}>EL-KANEMI{'\n'}COLLEGE</Text>
            </View>
          </View>
          <View style={styles.sigBox}>
            <Text style={styles.sigLine}>Al-Ustaz Al-Kabir</Text>
            <Text style={styles.sigTitle}>Board of Directors Executive</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Official document of El-Kanemi College of Islamic Theology</Text>
          <Text style={styles.footerText}>Weekly School Performance Review — confidential</Text>
        </View>
      </Page>
    </Document>
  )
}
