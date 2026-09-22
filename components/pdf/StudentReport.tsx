'use client'

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'

/* ─────────── Scholarly Islamic Color Palette ─────────── */
const PRIMARY_EMERALD = '#1e1b4b'
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
  schoolSubtitle: { fontSize: 8, color: SECONDARY_GOLD, marginTop: 1 },
  reportMeta: { textAlign: 'right' },
  reportTitle: { fontSize: 10, fontWeight: 'bold', color: PRIMARY_EMERALD },
  reportSub: { fontSize: 8, color: TEXT_MUTED, marginTop: 2 },
  identityGrid: {
    flexDirection: 'row', backgroundColor: '#ffffff',
    borderWidth: 1, borderStyle: 'solid', borderColor: BORDER_LIGHT,
    borderRadius: 8, padding: 8, marginBottom: 8,
    justifyContent: 'space-between', alignItems: 'center',
  },
  identityCol: { flexDirection: 'column', gap: 2 },
  idLabel: { fontSize: 7, color: TEXT_MUTED, textTransform: 'uppercase', fontWeight: 'bold' },
  idValue: { fontSize: 9, fontWeight: 'bold', color: TEXT_DARK },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  statCard: {
    flex: 1, backgroundColor: '#ffffff',
    borderWidth: 1, borderStyle: 'solid', borderColor: BORDER_LIGHT,
    borderRadius: 8, padding: 8, alignItems: 'center',
  },
  statVal: { fontSize: 14, fontWeight: 'bold', color: PRIMARY_EMERALD },
  statLbl: { fontSize: 7, color: TEXT_MUTED, marginTop: 2, textTransform: 'uppercase' },
  sectionTitle: {
    fontSize: 9, fontWeight: 'bold', color: PRIMARY_EMERALD,
    textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: PRIMARY_EMERALD,
    paddingBottom: 2, marginBottom: 4, marginTop: 2,
  },
  table: {
    borderWidth: 1, borderStyle: 'solid', borderColor: BORDER_LIGHT,
    borderRadius: 6, overflow: 'hidden', marginBottom: 8,
  },
  tableHeader: { flexDirection: 'row', backgroundColor: PRIMARY_EMERALD, padding: 4 },
  th: { color: '#ffffff', fontSize: 7, fontWeight: 'bold', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', padding: 4, borderBottomWidth: 1, borderBottomColor: BORDER_LIGHT, alignItems: 'center' },
  tableRowAlt: { flexDirection: 'row', padding: 4, borderBottomWidth: 1, borderBottomColor: BORDER_LIGHT, backgroundColor: '#f8fafc', alignItems: 'center' },
  td: { fontSize: 8, color: TEXT_DARK },
  remarksBox: {
    backgroundColor: '#f0fdf4', borderWidth: 1, borderStyle: 'solid', borderColor: '#bbf7d0',
    borderRadius: 8, padding: 8, marginBottom: 10,
  },
  remarksText: { fontSize: 8.5, lineHeight: 1.4, color: PRIMARY_EMERALD },
  signatureSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, paddingHorizontal: 10 },
  sigBox: { width: '28%', alignItems: 'center' },
  sigLine: { borderTopWidth: 1, borderTopColor: TEXT_DARK, width: '100%', paddingTop: 4, marginTop: 24, fontSize: 7.5, textAlign: 'center', fontWeight: 'bold' },
  sigTitle: { fontSize: 6.5, color: TEXT_MUTED, marginTop: 1 },
  stampBox: { width: '28%', alignItems: 'center', justifyContent: 'center' },
  stampCircle: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: SECONDARY_GOLD,
    alignItems: 'center', justifyContent: 'center', padding: 4,
  },
  stampText: { fontSize: 6, color: SECONDARY_GOLD, textAlign: 'center', fontWeight: 'bold' },
  footer: {
    position: 'absolute', bottom: 16, left: 24, right: 24, flexDirection: 'row',
    justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: BORDER_LIGHT, paddingTop: 4,
  },
  footerText: { fontSize: 6.5, color: TEXT_MUTED },
})

function getBadge(avgSafhas: number, targetSafhas: number) {
  const ratio = targetSafhas > 0 ? avgSafhas / targetSafhas : 1
  if (ratio >= 1.0) return { label: 'EXCELLENT / ON TARGET', bg: '#e0e7ff', color: '#4338ca' }
  if (ratio >= 0.66) return { label: 'NEEDS IMPROVEMENT', bg: '#fef9c3', color: '#a16207' }
  return { label: 'CRITICAL / AT RISK', bg: '#fee2e2', color: '#b91c1c' }
}

function generateSummaryText(studentName: string, totalSafhas: number, avgSafhas: string, targetSafhas: number) {
  return `Academic assessment summary for student ${studentName || 'Student'}. During the current evaluation period, the student achieved a total memorisation output of ${totalSafhas} Safhas, averaging ${avgSafhas} Safhas per week against the target of ${targetSafhas} Safhas. Performance is continuously monitored to ensure consistent progress in the noble journey of memorisation.`
}

export const StudentReportSinglePage = ({
  studentName = 'Student',
  className = 'Class',
  teacherName = 'Teacher',
  weeklyProgress = [],
  targetSafhas = 6,
  currentWeek = 1,
  termName = 'Current Term',
  isEndOfTerm = false,
}: any) => {
  const safeProgress = Array.isArray(weeklyProgress) ? weeklyProgress : []
  const hifzEntries = safeProgress.filter((p: any) => p.hifzType === 'hifz')
  const totalSafhas = hifzEntries.reduce((acc: number, p: any) => acc + (p.totalSafhas || 0), 0)
  const avgSafhas = hifzEntries.length ? (totalSafhas / hifzEntries.length).toFixed(1) : '0'
  const badge = getBadge(parseFloat(avgSafhas), targetSafhas)
  const recentLogs = safeProgress.slice(0, 8)
  const narrative = generateSummaryText(studentName, totalSafhas, avgSafhas, targetSafhas)

  // Absolute origin for React-PDF image fetcher
  const logoUrl = typeof window !== 'undefined' ? `${window.location.origin}/logo/logo.png` : '/logo/logo.png'

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.pageBorder} />

      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image src={logoUrl} style={styles.logo} />
          <View>
            <Text style={styles.schoolName}>El-Kanemi College</Text>
            <Text style={styles.schoolSubtitle}>Quranic Memorisation & Hifz Academy</Text>
          </View>
        </View>
        <View style={styles.reportMeta}>
          <Text style={styles.reportTitle}>{isEndOfTerm ? 'End of Term Report' : 'Weekly Assessment'}</Text>
          <Text style={styles.reportSub}>{termName || 'Academic Term'} — W{currentWeek}</Text>
        </View>
      </View>

      <View style={styles.identityGrid}>
        <View style={styles.identityCol}>
          <Text style={styles.idLabel}>Student name</Text>
          <Text style={styles.idValue}>{studentName}</Text>
        </View>
        <View style={styles.identityCol}>
          <Text style={styles.idLabel}>Classroom</Text>
          <Text style={styles.idValue}>{className}</Text>
        </View>
        <View style={styles.identityCol}>
          <Text style={styles.idLabel}>Assigned Ustaz</Text>
          <Text style={styles.idValue}>{teacherName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{totalSafhas}</Text>
          <Text style={styles.statLbl}>Total Safhas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{avgSafhas}</Text>
          <Text style={styles.statLbl}>Avg Safhas/wk</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{hifzEntries.length}</Text>
          <Text style={styles.statLbl}>Hifz Sessions</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{safeProgress.filter((p: any) => p.hifzType === 'murajaah').length}</Text>
          <Text style={styles.statLbl}>Murajaah Sessions</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Evaluation Log (Last 8 sessions)</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { width: '15%' }]}>Date</Text>
          <Text style={[styles.th, { width: '15%' }]}>Type</Text>
          <Text style={[styles.th, { width: '10%' }]}>Safhas</Text>
          <Text style={[styles.th, { width: '25%' }]}>Surah Range</Text>
          <Text style={[styles.th, { width: '35%' }]}>Assessment Notes</Text>
        </View>

        {recentLogs.length === 0 ? (
          <View style={styles.tableRow}>
            <Text style={[styles.td, { width: '100%', textAlign: 'center', padding: 6 }]}>No evaluation entries recorded yet.</Text>
          </View>
        ) : (
          recentLogs.map((week: any, i: number) => {
            const isAlt = i % 2 === 1
            const rowStyle = isAlt ? styles.tableRowAlt : styles.tableRow
            return (
              <View key={i} style={rowStyle}>
                <Text style={[styles.td, { width: '15%' }]}>{week.weekStart || '—'}</Text>
                <Text style={[styles.td, { width: '15%', fontWeight: 'bold' }]}>{week.hifzType === 'murajaah' ? 'Murajaah' : 'Hifz'}</Text>
                <Text style={[styles.td, { width: '10%', fontWeight: 'bold', color: SECONDARY_GOLD }]}>{week.totalSafhas || '0'}</Text>
                <Text style={[styles.td, { width: '25%' }]}>{week.startSurah || '-'} - {week.endSurah || '-'}</Text>
                <Text style={[styles.td, { width: '35%', fontStyle: 'italic' }]}>{week.comments || '—'}</Text>
              </View>
            )
          })
        )}
      </View>

      <Text style={styles.sectionTitle}>Ustaz Assessment Remarks</Text>
      <View style={styles.remarksBox}>
        <Text style={styles.remarksText}>{narrative}</Text>
      </View>

      <View style={styles.signatureSection}>
        <View style={styles.sigBox}>
          <Text style={styles.sigLine}>{teacherName}</Text>
          <Text style={styles.sigTitle}>Classroom Ustaz</Text>
        </View>
        <View style={styles.stampBox}>
          <View style={styles.stampCircle}>
            <Text style={styles.stampText}>EL-KANEMI{'\n'}COLLEGE</Text>
          </View>
        </View>
        <View style={styles.sigBox}>
          <Text style={styles.sigLine}>Al-Ustaz Al-A'zam</Text>
          <Text style={styles.sigTitle}>Head of School / Director</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Official document of El-Kanemi College of Islamic Theology</Text>
        <Text style={styles.footerText}>{termName} Evaluation Period</Text>
      </View>
    </Page>
  )
}

export const StudentReportPDF = (props: any) => (
  <Document>
    <StudentReportSinglePage {...props} />
  </Document>
)

export const ClassReportsPDF = ({ studentReportsData = [], termName, currentWeek, targetSafhas, isEndOfTerm }: any) => {
  const safeReports = Array.isArray(studentReportsData) ? studentReportsData : []
  return (
    <Document>
      {safeReports.map((report: any) => (
        <StudentReportSinglePage
          key={report.studentId || report.studentName}
          studentName={report.studentName}
          className={report.className}
          teacherName={report.teacherName}
          weeklyProgress={report.weeklyProgress}
          targetSafhas={targetSafhas}
          currentWeek={currentWeek}
          termName={termName}
          isEndOfTerm={isEndOfTerm}
        />
      ))}
    </Document>
  )
}
