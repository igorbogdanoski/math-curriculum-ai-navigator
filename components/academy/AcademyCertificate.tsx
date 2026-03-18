import React from 'react';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { Award, Download, Loader2 } from 'lucide-react';

// Create styles for the PDF
const styles = StyleSheet.create({
  page: {
    padding: 60,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
  },
  border: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    border: '2 solid #4f46e5',
  },
  innerBorder: {
    position: 'absolute',
    top: 30,
    left: 30,
    right: 30,
    bottom: 30,
    border: '1 solid #e5e7eb',
  },
  header: {
    marginTop: 40,
    textAlign: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: 'black',
    color: '#1e1b4b',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 18,
    color: '#4f46e5',
    marginBottom: 40,
    letterSpacing: 2,
  },
  body: {
    textAlign: 'center',
    marginBottom: 40,
  },
  recipientText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 10,
  },
  name: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottom: '1 solid #e5e7eb',
    width: '80%',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  description: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 1.5,
    maxWidth: '80%',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  footer: {
    marginTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seal: {
    width: 80,
    height: 80,
    backgroundColor: '#fbbf24',
    borderRadius: '50%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sealText: {
    color: '#78350f',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  signatureBox: {
    width: 150,
    borderTop: '1 solid #9ca3af',
    paddingTop: 8,
    textAlign: 'center',
  },
  signatureText: {
    fontSize: 10,
    color: '#6b7280',
  },
  date: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 40,
    textAlign: 'center',
  }
});

interface CertificateProps {
  userName: string;
  specializationTitle: string;
  date: string;
}

// Deterministic ID — same props always produce the same cert ID
function certId(userName: string, specTitle: string, date: string): string {
  const str = `${userName}|${specTitle}|${date}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
}

const CertificateDocument = ({ userName, specializationTitle, date }: CertificateProps) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.border} />
      <View style={styles.innerBorder} />
      
      <View style={styles.header}>
        <Text style={styles.title}>СЕРТИФИКАТ</Text>
        <Text style={styles.subtitle}>ЗА ПРОФЕСИОНАЛНО УСОВРШУВАЊЕ</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.recipientText}>Овој сертификат се доделува на:</Text>
        <Text style={styles.name}>{userName}</Text>
        <Text style={styles.description}>
          За успешно завршена специјализација во областа на "{specializationTitle}" 
          во рамките на Едукативниот Центар на Math Navigator.
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.signatureBox}>
          <Text style={{ fontSize: 14, color: '#1e1b4b', marginBottom: 4 }}>Math Navigator AI</Text>
          <Text style={styles.signatureText}>Платформа за поддршка на наставници</Text>
        </View>
        
        <View style={styles.seal}>
          <Text style={styles.sealText}>VALIDATED BY AI</Text>
        </View>

        <View style={styles.signatureBox}>
          <Text style={{ fontSize: 14, color: '#1e1b4b', marginBottom: 4 }}>Дигитален Печат</Text>
          <Text style={styles.signatureText}>ID: {certId(userName, specializationTitle, date)}</Text>
        </View>
      </View>

      <Text style={styles.date}>Издаден на: {date}</Text>
    </Page>
  </Document>
);

export const AcademyCertificateButton: React.FC<CertificateProps & { className?: string }> = ({ 
  userName, 
  specializationTitle, 
  date,
  className 
}) => {
  return (
    <PDFDownloadLink
      document={<CertificateDocument userName={userName} specializationTitle={specializationTitle} date={date} />}
      fileName={`Certificate_${specializationTitle.replace(/\s+/g, '_')}.pdf`}
      className={`flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-brand-secondary transition-all shadow-md hover:shadow-lg ${className}`}
    >
      {({ loading }) => (
        <>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Преземи Сертификат
        </>
      )}
    </PDFDownloadLink>
  );
};
