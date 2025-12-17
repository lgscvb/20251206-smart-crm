import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link
} from '@react-pdf/renderer'
// 字體在 main.jsx 統一註冊

// 樣式定義
const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansTC',
    fontSize: 10,
    padding: 40,
    backgroundColor: '#ffffff'
  },
  header: {
    textAlign: 'center',
    marginBottom: 20
  },
  logo: {
    width: 60,
    height: 60,
    backgroundColor: '#2d5a27',
    borderRadius: 30,
    marginBottom: 8,
    alignSelf: 'center'
  },
  logoText: {
    fontSize: 10,
    color: '#2d5a27',
    letterSpacing: 2,
    marginBottom: 8
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2d5a27',
    marginTop: 10
  },
  quoteInfo: {
    textAlign: 'right',
    marginBottom: 15,
    fontSize: 9,
    color: '#666666'
  },
  table: {
    display: 'flex',
    width: '100%',
    marginBottom: 20
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#dddddd'
  },
  tableHeaderCell: {
    padding: 10,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  tableRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#dddddd'
  },
  tableCellName: {
    width: '70%',
    padding: 8,
    textAlign: 'left'
  },
  tableCellAmount: {
    width: '30%',
    padding: 8,
    textAlign: 'right',
    fontFamily: 'Helvetica'
  },
  sectionHeader: {
    flexDirection: 'row',
    backgroundColor: '#fafafa',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#dddddd'
  },
  sectionHeaderText: {
    padding: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%'
  },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#dddddd'
  },
  totalLabel: {
    width: '70%',
    padding: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#2d5a27',
    fontSize: 12
  },
  totalAmount: {
    width: '30%',
    padding: 10,
    fontWeight: 'bold',
    textAlign: 'right',
    color: '#2d5a27',
    fontSize: 12,
    fontFamily: 'Helvetica'
  },
  bankInfo: {
    marginBottom: 20
  },
  bankRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#eeeeee',
    paddingVertical: 6
  },
  bankLabel: {
    width: 80,
    color: '#666666',
    backgroundColor: '#fafafa',
    padding: 6
  },
  bankValue: {
    flex: 1,
    textAlign: 'right',
    padding: 6
  },
  notes: {
    backgroundColor: '#fafafa',
    padding: 15,
    borderRadius: 5,
    marginBottom: 15
  },
  notesTitle: {
    fontWeight: 'bold',
    marginBottom: 8
  },
  noteItem: {
    marginBottom: 4,
    lineHeight: 1.6
  },
  footerNote: {
    marginTop: 15,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#dddddd',
    fontSize: 9,
    color: '#666666'
  },
  link: {
    color: '#2d5a27'
  }
})

// 格式化金額
const formatCurrency = (amount) => {
  if (!amount) return '0'
  return Number(amount).toLocaleString('zh-TW')
}

// 報價單 PDF 元件
export default function QuotePDF({ data }) {
  const {
    quote_number,
    valid_from,
    valid_until,
    branch_name = '台中館',
    plan_name,
    items = [],
    deposit_amount = 6000,
    total_amount = 0,
    bank_account_name = '你的空間有限公司',
    bank_name = '永豐商業銀行(南台中分行)',
    bank_code = '807',
    bank_account_number = '03801800183399',
    contact_email = 'wtxg@hourjungle.com',
    contact_phone = '04-23760282'
  } = data

  // 計算總金額（含押金）
  const grandTotal = Number(total_amount) + Number(deposit_amount)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 標題區 */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginTop: 18 }}>HJ</Text>
          </View>
          <Text style={styles.logoText}>HOUR JUNGLE</Text>
          <Text style={styles.title}>HourJungle {branch_name}報價單</Text>
        </View>

        {/* 報價單資訊 */}
        <View style={styles.quoteInfo}>
          <Text>報價單號：{quote_number}</Text>
          <Text>報價日期：{valid_from}</Text>
          <Text>有效期限：{valid_until}</Text>
        </View>

        {/* 服務項目表格 */}
        <View style={styles.table}>
          {/* 表頭 */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { width: '70%' }]}>服務項目</Text>
            <Text style={[styles.tableHeaderCell, { width: '30%' }]}>請款金額 (NTD)</Text>
          </View>

          {/* 方案標題 */}
          {plan_name && (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>
                {plan_name}（依合約內指定付款時間點）
              </Text>
            </View>
          )}

          {/* 項目列表 */}
          {items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.tableCellName}>{item.name}</Text>
              <Text style={styles.tableCellAmount}>{formatCurrency(item.amount)}</Text>
            </View>
          ))}

          {/* 押金 */}
          {deposit_amount > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCellName}>押金</Text>
              <Text style={styles.tableCellAmount}>{formatCurrency(deposit_amount)}</Text>
            </View>
          )}

          {/* 合計 */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>合計</Text>
            <Text style={styles.totalAmount}>{formatCurrency(grandTotal)}</Text>
          </View>
        </View>

        {/* 銀行資訊 */}
        <View style={styles.bankInfo}>
          <View style={styles.bankRow}>
            <Text style={styles.bankLabel}>帳戶名稱：</Text>
            <Text style={styles.bankValue}>{bank_account_name}</Text>
          </View>
          <View style={styles.bankRow}>
            <Text style={styles.bankLabel}>銀行名稱：</Text>
            <Text style={styles.bankValue}>{bank_name}</Text>
          </View>
          <View style={styles.bankRow}>
            <Text style={styles.bankLabel}>行庫代號：</Text>
            <Text style={styles.bankValue}>{bank_code}</Text>
          </View>
          <View style={styles.bankRow}>
            <Text style={styles.bankLabel}>帳號：</Text>
            <Text style={styles.bankValue}>{bank_account_number}</Text>
          </View>
        </View>

        {/* 備註 */}
        <View style={styles.notes}>
          <Text style={styles.notesTitle}>備註：</Text>
          <Text style={styles.noteItem}>1. 報價有效期間：即日起30天內。</Text>
          <Text style={styles.noteItem}>2. 獨家！威立方（V-CUBE）集團，指定合作夥伴E樂堂企業內訓系統會員免費獨享。</Text>
          <Text style={styles.noteItem}>3. 超過百間以上蝦皮店家登記指定選擇hourjungle，可登記使用免用統一發票（限無店面零售業）電商最划算的選擇。</Text>
          <Text style={styles.noteItem}>4. 全台灣唯一敢在合約內註明如因我方因素主管機關不予核准，我們全額退費！</Text>
          <Text style={styles.noteItem}>5. 多位知名客戶阿里巴巴、UBER、唐吉軻德、arrow（全球五百大企業）指定選擇解決方案。</Text>
          <Text style={styles.noteItem}>6. 獨家！蝦皮商城免費健檢！提供金、物流、包材、bsmi、財稅法一站式解決方案。再送一年免費稅務諮詢。</Text>
          <Text style={styles.noteItem}>7. 獨家！勞動部TTQS認證單位，不定期超過百種創業課程會員免費獨享。</Text>
          <Text style={styles.noteItem}>8. 獨家經濟部中小企業處認證國際育成中心！</Text>
          <Text style={styles.noteItem}>9. 獨家！國科會科研平台輔導業師進駐。</Text>
          <Text style={styles.noteItem}>
            10. 有任何問題請洽詢公司信箱 <Link src={`mailto:${contact_email}`} style={styles.link}>{contact_email}</Link> 或電話 {contact_phone}。
          </Text>
        </View>

        {/* 頁尾提醒 */}
        <View style={styles.footerNote}>
          <Text>本公司之報價不包含銀行匯款手續費，匯款後請閣下將匯款憑證回傳本公司，以便進行確認。</Text>
        </View>
      </Page>
    </Document>
  )
}
