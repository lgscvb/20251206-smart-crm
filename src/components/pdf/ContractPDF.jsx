import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font
} from '@react-pdf/renderer'

// 註冊中文字體 (使用子集化字體)
Font.register({
  family: 'NotoSansTC',
  fonts: [
    {
      src: '/fonts/NotoSansTC-Regular-Subset.ttf',
      fontWeight: 'normal'
    },
    {
      src: '/fonts/NotoSansTC-Bold-Subset.ttf',
      fontWeight: 'bold'
    }
  ]
})

// 樣式定義
const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansTC',
    fontSize: 10,
    padding: 50,
    paddingLeft: 60,
    paddingRight: 60,
    backgroundColor: '#ffffff',
    lineHeight: 1.8
  },
  header: {
    textAlign: 'center',
    marginBottom: 25
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 6
  },
  contractNumber: {
    textAlign: 'right',
    fontSize: 9,
    color: '#666666',
    marginBottom: 15
  },
  parties: {
    marginBottom: 20
  },
  partyRow: {
    flexDirection: 'row',
    marginBottom: 6
  },
  partyLabel: {
    width: 60,
    fontWeight: 'bold'
  },
  partyValue: {
    flex: 1
  },
  intro: {
    textIndent: 20,
    marginBottom: 15
  },
  article: {
    marginBottom: 15
  },
  articleTitle: {
    fontWeight: 'bold',
    marginBottom: 6
  },
  articleContent: {
    textIndent: 20,
    textAlign: 'justify'
  },
  table: {
    marginVertical: 10
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    minHeight: 28
  },
  tableHeader: {
    width: 100,
    backgroundColor: '#f5f5f5',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#333333',
    borderLeftWidth: 1,
    borderLeftColor: '#333333'
  },
  tableCell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#333333'
  },
  tableFirstRow: {
    borderTopWidth: 1,
    borderTopColor: '#333333'
  },
  termsList: {
    marginLeft: 20
  },
  termItem: {
    marginBottom: 6,
    textAlign: 'justify'
  },
  signatureArea: {
    marginTop: 40
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  signatureBox: {
    width: '45%'
  },
  signatureLabel: {
    fontWeight: 'bold',
    marginBottom: 8
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    paddingBottom: 4,
    marginBottom: 6,
    minHeight: 20
  },
  dateLine: {
    textAlign: 'center',
    marginTop: 30,
    fontSize: 11,
    letterSpacing: 2
  },
  bold: {
    fontWeight: 'bold'
  },
  underline: {
    textDecoration: 'underline'
  }
})

// 格式化金額
const formatCurrency = (amount) => {
  if (!amount) return '0'
  return Number(amount).toLocaleString('zh-TW')
}

// 合約類型對照
const CONTRACT_TYPE_NAMES = {
  'virtual_office': '虛擬辦公室',
  'coworking_fixed': '固定座位',
  'coworking_flexible': '彈性座位',
  'meeting_room': '會議室'
}

// 合約 PDF 元件
export default function ContractPDF({ data }) {
  const {
    contract_number = '',
    branch_name = '台中館',
    branch_address = '',
    branch_phone = '',
    company_name = '',
    customer_name = '',
    tax_id = '',
    id_number = '',
    company_address = '',
    contact_phone = '',
    contact_email = '',
    contract_type = 'coworking_fixed',
    start_date = '',
    end_date = '',
    periods = 12,
    list_price = 0,
    monthly_fee = 0,
    payment_day = 5,
    deposit = 0,
    notes = ''
  } = data

  // 格式化日期
  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`
  }

  // 今日日期（民國）
  const today = new Date()
  const rocYear = today.getFullYear() - 1911
  const todayMonth = today.getMonth() + 1
  const todayDay = today.getDate()

  const contractTypeName = CONTRACT_TYPE_NAMES[contract_type] || contract_type
  const partyBName = company_name || customer_name

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 標題 */}
        <View style={styles.header}>
          <Text style={styles.title}>共同工作室租賃契約</Text>
        </View>

        {/* 合約編號 */}
        <View style={styles.contractNumber}>
          <Text>合約編號：{contract_number}</Text>
        </View>

        {/* 當事人 */}
        <View style={styles.parties}>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>出租人：</Text>
            <Text style={styles.partyValue}>{branch_name}（以下簡稱甲方）</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>承租人：</Text>
            <Text style={styles.partyValue}>{partyBName}（以下簡稱乙方）</Text>
          </View>
        </View>

        {/* 前言 */}
        <Text style={styles.intro}>
          甲乙雙方同意依下列條款訂立本租賃契約：
        </Text>

        {/* 第一條 */}
        <View style={styles.article}>
          <Text style={styles.articleTitle}>第一條（租賃標的）</Text>
          <Text style={styles.articleContent}>
            甲方同意將座落於 {branch_address} 之共同工作空間出租予乙方使用。
          </Text>
        </View>

        {/* 第二條 */}
        <View style={styles.article}>
          <Text style={styles.articleTitle}>第二條（租賃期限）</Text>
          <Text style={styles.articleContent}>
            租賃期間自 {formatDate(start_date)} 起至 {formatDate(end_date)} 止，共計 {periods} 個月。
          </Text>
        </View>

        {/* 第三條 */}
        <View style={styles.article}>
          <Text style={styles.articleTitle}>第三條（租金及付款方式）</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableFirstRow]}>
              <Text style={styles.tableHeader}>服務類型</Text>
              <Text style={styles.tableCell}>{contractTypeName}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>月租金定價</Text>
              <Text style={styles.tableCell}>新台幣 {formatCurrency(list_price)} 元整</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>優惠後月租</Text>
              <Text style={styles.tableCell}>新台幣 {formatCurrency(monthly_fee)} 元整</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>繳款日</Text>
              <Text style={styles.tableCell}>每月 {payment_day} 日前</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>履約保證金</Text>
              <Text style={styles.tableCell}>新台幣 {formatCurrency(deposit)} 元整</Text>
            </View>
          </View>
          <Text style={styles.articleContent}>
            乙方應於每月 {payment_day} 日前繳納當月租金，逾期未繳納者，甲方得依約收取滯納金。
          </Text>
        </View>

        {/* 第四條 */}
        <View style={styles.article}>
          <Text style={styles.articleTitle}>第四條（履約保證金）</Text>
          <Text style={styles.articleContent}>
            乙方應於簽約時繳納履約保證金新台幣 {formatCurrency(deposit)} 元整，於租賃期滿並完成點交後無息退還。如乙方有違約情事或積欠租金，甲方得自保證金中扣抵。
          </Text>
        </View>

        {/* 第五條 */}
        <View style={styles.article}>
          <Text style={styles.articleTitle}>第五條（使用規定）</Text>
          <View style={styles.termsList}>
            <Text style={styles.termItem}>一、乙方應遵守甲方訂定之共同工作空間使用規則。</Text>
            <Text style={styles.termItem}>二、乙方不得將租賃標的全部或一部轉租、出借或以其他方式供他人使用。</Text>
            <Text style={styles.termItem}>三、乙方應維護公共區域之整潔，並不得有影響其他承租人權益之行為。</Text>
            <Text style={styles.termItem}>四、乙方不得於租賃標的內從事違法行為或存放危險物品。</Text>
          </View>
        </View>

        {/* 第六條 */}
        <View style={styles.article}>
          <Text style={styles.articleTitle}>第六條（提前終止）</Text>
          <Text style={styles.articleContent}>
            任一方如欲提前終止本契約，應於一個月前以書面通知他方。乙方提前終止者，甲方得沒收已繳納之履約保證金。
          </Text>
        </View>

        {/* 第七條 */}
        <View style={styles.article}>
          <Text style={styles.articleTitle}>第七條（契約之續約）</Text>
          <Text style={styles.articleContent}>
            租賃期滿如欲續約，乙方應於期滿一個月前向甲方提出申請，經甲方同意後另訂新約。
          </Text>
        </View>

        {/* 第八條 */}
        <View style={styles.article}>
          <Text style={styles.articleTitle}>第八條（其他約定事項）</Text>
          <Text style={styles.articleContent}>
            {notes || '無。'}
          </Text>
        </View>

        {/* 第九條 */}
        <View style={styles.article}>
          <Text style={styles.articleTitle}>第九條（管轄法院）</Text>
          <Text style={styles.articleContent}>
            本契約如有爭議，雙方同意以台灣台北地方法院為第一審管轄法院。
          </Text>
        </View>

        {/* 契約份數 */}
        <Text style={{ marginTop: 20 }}>
          本契約一式貳份，由甲乙雙方各執乙份為憑。
        </Text>

        {/* 簽名區 */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureRow}>
            {/* 甲方 */}
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>甲方（出租人）</Text>
              <View style={styles.signatureLine}>
                <Text>公司名稱：{branch_name}</Text>
              </View>
              <View style={styles.signatureLine}>
                <Text>地址：{branch_address}</Text>
              </View>
              <View style={styles.signatureLine}>
                <Text>電話：{branch_phone}</Text>
              </View>
              <View style={styles.signatureLine}>
                <Text>負責人：</Text>
              </View>
              <View style={styles.signatureLine}>
                <Text>簽章：</Text>
              </View>
            </View>

            {/* 乙方 */}
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>乙方（承租人）</Text>
              <View style={styles.signatureLine}>
                <Text>公司/姓名：{partyBName}</Text>
              </View>
              <View style={styles.signatureLine}>
                <Text>統一編號：{tax_id}</Text>
              </View>
              <View style={styles.signatureLine}>
                <Text>身分證號：{id_number}</Text>
              </View>
              <View style={styles.signatureLine}>
                <Text>地址：{company_address}</Text>
              </View>
              <View style={styles.signatureLine}>
                <Text>電話：{contact_phone}</Text>
              </View>
              <View style={styles.signatureLine}>
                <Text>Email：{contact_email}</Text>
              </View>
              <View style={styles.signatureLine}>
                <Text>負責人：{customer_name}</Text>
              </View>
              <View style={styles.signatureLine}>
                <Text>簽章：</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 日期 */}
        <Text style={styles.dateLine}>
          中　華　民　國　{rocYear}　年　{todayMonth}　月　{todayDay}　日
        </Text>
      </Page>
    </Document>
  )
}
