import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet
} from '@react-pdf/renderer'
// 字體在 main.jsx 統一註冊

// 樣式
const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansTC',
    fontSize: 9,
    padding: 40,
    paddingTop: 30,
    paddingBottom: 40,
    backgroundColor: '#ffffff',
    lineHeight: 1.6
  },
  logoContainer: { alignItems: 'center', marginBottom: 12 },
  logoText: { fontSize: 14, fontWeight: 'bold', color: '#2d5016' },
  title: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  parties: { marginBottom: 12 },
  partyLine: { marginBottom: 3 },
  intro: { marginBottom: 12 },
  article: { marginBottom: 10 },
  articleTitle: { fontWeight: 'bold' },
  subItem: { marginLeft: 0, marginBottom: 2 },
  signatureSection: { marginTop: 30 },
  signatureRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  signatureBox: { width: '48%' },
  signatureLine: { marginBottom: 8 },
  dateLine: { textAlign: 'right', marginTop: 25 },
  pageNumber: { position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 8, color: '#666' },
  bold: { fontWeight: 'bold' }
})

// 格式化金額
const formatCurrency = (amount) => {
  if (!amount) return '0'
  const num = Number(amount)
  if (isNaN(num)) return '0'
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// 格式化日期為民國年
const formatDateROC = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const rocYear = date.getFullYear() - 1911
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${rocYear}年${String(month).padStart(2, '0')}月${String(day).padStart(2, '0')}日`
}

// 印章圖片路徑
const STAMP_IMAGES = {
  1: '/images/stamp-yourspace.png',
  2: '/images/stamp-pivotfrontier.png'
}

export default function FlexSeatPDF({ data }) {
  const {
    branch_company_name = '',
    branch_tax_id = '',
    branch_representative = '戴豪廷',
    branch_address = '',
    branch_court = '台南地方法院',
    branch_id = 1,
    company_name = '',
    representative_name = '',
    representative_address = '',
    company_tax_id = '',
    phone = '',
    start_date = '',
    monthly_rent = 0,
    payment_day = 1,
    show_stamp = false
  } = data

  const stampImage = STAMP_IMAGES[branch_id] || STAMP_IMAGES[1]

  const today = new Date()
  const rocYear = today.getFullYear() - 1911
  const todayMonth = String(today.getMonth() + 1).padStart(2, '0')
  const todayDay = String(today.getDate()).padStart(2, '0')

  const partyBName = company_name || representative_name || ''
  const monthlyRentStr = formatCurrency(monthly_rent)

  // 使用範圍
  const locationText = `${branch_address}以及附屬公共設備開放時間為週一至週五09:00~18:00`

  return (
    <Document>
      {/* 第一頁 */}
      <Page size="A4" style={styles.page}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>HOUR JUNGLE</Text>
        </View>

        <Text style={styles.title}>共同工作室租賃契約</Text>

        <View style={styles.parties}>
          <Text style={styles.partyLine}>立契約人</Text>
          <Text style={styles.partyLine}>出租人：{branch_company_name}(以下簡稱甲方)</Text>
          <Text style={styles.partyLine}>承租人：{partyBName}(以下簡稱乙方)</Text>
        </View>

        <Text style={styles.intro}>因工作室租賃事件，訂立本契約，雙方同意之條件如左：</Text>

        <View style={styles.article}>
          <Text><Text style={styles.articleTitle}>第一條：所在地及使用範圍：</Text> {locationText}</Text>
        </View>

        <View style={styles.article}>
          <Text><Text style={styles.articleTitle}>第二條：租賃期限：</Text>自{formatDateROC(start_date)}起，如雙方無異議則自動續約一個月。</Text>
        </View>

        <View style={styles.article}>
          <Text style={styles.articleTitle}>第三條：租金：</Text>
          <Text style={styles.subItem}>一、每月自由座租金新台幣{monthlyRentStr}元，(每月為一期，匯款手續費由乙方自行負責)</Text>
          <Text style={styles.subItem}>二、每期租金繳納日期每月{String(payment_day).padStart(2, '0')}日</Text>
        </View>

        <View style={styles.article}>
          <Text style={styles.articleTitle}>第四條：使用租物之限制：</Text>
          <Text style={styles.subItem}>一、乙方不得將使用權限之全部或一部分轉租、出租、頂讓，或以其他變相方法使用工作室。</Text>
          <Text style={styles.subItem}>二、每一承租戶僅能申請一家公司執照。</Text>
          <Text style={styles.subItem}>三、乙方於租賃期滿應立即將工作空間遷讓交還，不得向甲方請求遷移費或任何費用。</Text>
          <Text style={styles.subItem}>四、工作室不得供非法使用，或經營非法之行業，或存收危險物品影響公共安全，若發現之，甲方有全權無條件終止合約，已支付租金不退還。</Text>
          <Text style={styles.subItem}>五、工作空間若有改裝設施之必要，乙方得甲方同意後得自行裝設，但不得損害原有建築，乙方於交還房屋時並應負責回復原狀。</Text>
          <Text style={styles.subItem}>六、乙方若欲退租或轉約，需於一個月前通知甲方，自乙方通知日後起算一個月為甲乙雙方合約終止日。</Text>
          <Text style={styles.subItem}>七、禁止架設伺服器以及礦機，若發現之，甲方有全權無條件終止合約，已支付租金不退還。</Text>
        </View>

        <View style={styles.article}>
          <Text><Text style={styles.articleTitle}>第五條：危險負擔：</Text>乙方應以善良管理人之注意使用房屋，除因天災地變等不可抗拒之情形外，因乙方之過失致房屋毀損，應負損害賠償之責。</Text>
        </View>

        <View style={styles.article}>
          <Text style={styles.articleTitle}>第六條：違約處罰：</Text>
          <Text style={styles.subItem}>一、乙方違反約定方法使用工作室，或拖欠房租，超過七日甲方得終止租約，押金不得抵算租金。</Text>
          <Text style={styles.subItem}>二、乙方於終止租約或租賃期滿不交還工作室，自終止租約或租賃期滿之翌日起，乙方應支付案房租五倍計算之違約金，所遺留設備不搬者，視同乙方同意交由甲方處理。</Text>
        </View>

        <View style={styles.article}>
          <Text style={styles.articleTitle}>第七條：其他特約事項：</Text>
          <Text style={styles.subItem}>一、乙方除水電費(含公共電費)、管理費、網路費外，營業上必須繳納之稅捐需自行負擔。</Text>
          <Text style={styles.subItem}>二、乙方以甲方地址申請公司執照者，於合約終止時，需將公司登記遷出，甲方並依稅務等單位要求每月呈報遷出名單公文，否則甲方得將通報乙方營業登記遷出。</Text>
          <Text style={styles.subItem}>三、甲乙雙方僅有契約履行之責，乙方如與其他人有債務糾紛與法律責任，由乙方自行負責與甲方無關。</Text>
          <Text style={styles.subItem}>四、乙方如有寄放任何物品於甲方之處，甲方不負任何保管及法律責任，其責任問題均由乙方負全責。</Text>
        </View>

        <View style={styles.article}>
          <Text style={styles.articleTitle}>第八條：應受強制執行之事項：</Text>
          <Text style={styles.subItem}>一、租約到期或欠繳房租或終止租約生效時。</Text>
          <Text style={styles.subItem}>二、乙方如有違反稅法、稅捐稽徵法、社秩法及虛設行號等等不法之事，並影響甲方權益，甲方得立即中止甲乙雙方租約，並應官方要求通報相關單位。甲乙方若無任何違法情事或虛設行號，虛開發票等行為，而無法設籍此地，乙方得終止租約，不以違約論。</Text>
        </View>

        <View style={styles.article}>
          <Text><Text style={styles.articleTitle}>第九條：雙方確認事項</Text> 甲乙雙方同意，因本契約事項所生之一切爭議，雙方同意以{branch_court}為第一審管轄法院</Text>
        </View>

        <Text style={styles.pageNumber}>第1頁（共2頁）</Text>
      </Page>

      {/* 第二頁：簽名區 */}
      <Page size="A4" style={styles.page}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>HOUR JUNGLE</Text>
        </View>

        {/* 簽名區 */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureRow}>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLine}>出租人：{branch_company_name}</Text>
              <Text style={styles.signatureLine}>負責人：{branch_representative}</Text>
              <Text style={styles.signatureLine}>統一編號：{branch_tax_id}</Text>
            </View>
            {show_stamp ? (
              <Image src={stampImage} />
            ) : (
              <View style={{ width: 120, height: 80 }} />
            )}
          </View>

          <View style={{ marginTop: 50 }}>
            <Text style={styles.signatureLine}>承租人：{company_name}</Text>
            <Text style={styles.signatureLine}>負責人：{representative_name}</Text>
            <Text style={styles.signatureLine}>統一編號：{company_tax_id}</Text>
            <Text style={styles.signatureLine}>地址：{representative_address}</Text>
            <Text style={styles.signatureLine}>聯絡電話：{phone}</Text>
          </View>
        </View>

        <Text style={styles.dateLine}>{rocYear}年{todayMonth}月{todayDay}日</Text>
        <Text style={styles.pageNumber}>第2頁（共2頁）</Text>
      </Page>
    </Document>
  )
}
