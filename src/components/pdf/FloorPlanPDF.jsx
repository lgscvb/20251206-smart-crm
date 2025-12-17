import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image
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
    fontSize: 9,
    padding: 30,
    backgroundColor: '#ffffff'
  },
  header: {
    textAlign: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#2c5530'
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c5530'
  },
  subtitle: {
    fontSize: 10,
    color: '#666666',
    marginTop: 4
  },
  date: {
    fontSize: 9,
    color: '#999999',
    marginTop: 2
  },
  // 主要佈局
  mainContent: {
    flexDirection: 'row',
    gap: 15
  },
  leftSection: {
    width: '35%'
  },
  rightSection: {
    width: '65%'
  },
  // 統計區
  statsBox: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10
  },
  statsTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2c5530',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2c5530'
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 6
  },
  statItem: {
    width: '50%',
    backgroundColor: '#ffffff',
    padding: 8,
    borderWidth: 1,
    borderColor: '#eeeeee',
    textAlign: 'center'
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c5530'
  },
  statLabel: {
    fontSize: 8,
    color: '#666666',
    marginTop: 2
  },
  // 圖例
  legend: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#fafafa',
    borderRadius: 4
  },
  legendTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 6
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  legendBox: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 2,
    marginRight: 6
  },
  legendOccupied: {
    backgroundColor: '#ffffff'
  },
  legendVacant: {
    backgroundColor: '#f0f0f0',
    borderStyle: 'dashed'
  },
  legendText: {
    fontSize: 8
  },
  // 租戶表格
  tableWrapper: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 5,
    overflow: 'hidden'
  },
  tableHeader: {
    backgroundColor: '#2c5530',
    padding: 8
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff'
  },
  table: {
    width: '100%'
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd'
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee'
  },
  tableRowAlt: {
    backgroundColor: '#fafafa'
  },
  // 雙欄表格欄位
  colPos: {
    width: '8%',
    padding: 4,
    textAlign: 'center',
    fontWeight: 'bold'
  },
  colName: {
    width: '17%',
    padding: 4
  },
  colCompany: {
    width: '25%',
    padding: 4
  },
  thText: {
    fontWeight: 'bold',
    fontSize: 8
  },
  tdText: {
    fontSize: 8
  },
  tdBold: {
    fontSize: 8,
    fontWeight: 'bold'
  },
  // 頁尾
  footer: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eeeeee'
  }
})

// 格式化日期
const formatDate = () => {
  const now = new Date()
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
}

// 平面圖 PDF 元件
export default function FloorPlanPDF({ data }) {
  const {
    floor_plan = {},
    positions = [],
    statistics = {}
  } = data

  // 篩選已租用位置
  const occupiedPositions = positions.filter(p => p.contract_id)

  // 將已租用位置配對成雙欄（每行兩筆）
  const rows = []
  for (let i = 0; i < occupiedPositions.length; i += 2) {
    rows.push({
      left: occupiedPositions[i],
      right: occupiedPositions[i + 1] || null
    })
  }

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* 標題區 */}
        <View style={styles.header}>
          <Text style={styles.title}>{floor_plan.name || '大忠本館'} 租戶配置圖</Text>
          <Text style={styles.subtitle}>Hour Jungle 商務中心</Text>
          <Text style={styles.date}>製表日期：{formatDate()}</Text>
        </View>

        <View style={styles.mainContent}>
          {/* 左側：統計 + 圖例 */}
          <View style={styles.leftSection}>
            <View style={styles.statsBox}>
              <Text style={styles.statsTitle}>空間統計</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{statistics.total_positions || 0}</Text>
                  <Text style={styles.statLabel}>總位置數</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{statistics.occupied || 0}</Text>
                  <Text style={styles.statLabel}>已租用</Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{statistics.vacant || 0}</Text>
                  <Text style={styles.statLabel}>空位</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{statistics.occupancy_rate || '0%'}</Text>
                  <Text style={styles.statLabel}>出租率</Text>
                </View>
              </View>
            </View>

            <View style={styles.legend}>
              <Text style={styles.legendTitle}>圖例說明</Text>
              <View style={styles.legendRow}>
                <View style={[styles.legendBox, styles.legendOccupied]} />
                <Text style={styles.legendText}>已租用（有租戶）</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendBox, styles.legendVacant]} />
                <Text style={styles.legendText}>空位（待租）</Text>
              </View>
            </View>
          </View>

          {/* 右側：租戶表格 */}
          <View style={styles.rightSection}>
            <View style={styles.tableWrapper}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderText}>租戶名冊（國稅局備查）</Text>
              </View>
              <View style={styles.table}>
                {/* 表頭 */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.colPos, styles.thText]}>位置</Text>
                  <Text style={[styles.colName, styles.thText]}>負責人</Text>
                  <Text style={[styles.colCompany, styles.thText]}>公司名稱</Text>
                  <Text style={[styles.colPos, styles.thText]}>位置</Text>
                  <Text style={[styles.colName, styles.thText]}>負責人</Text>
                  <Text style={[styles.colCompany, styles.thText]}>公司名稱</Text>
                </View>

                {/* 資料列 */}
                {rows.map((row, index) => (
                  <View
                    key={index}
                    style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
                  >
                    {/* 左欄 */}
                    <Text style={[styles.colPos, styles.tdBold]}>
                      {row.left?.position_number || ''}
                    </Text>
                    <Text style={[styles.colName, styles.tdText]}>
                      {row.left?.customer_name || ''}
                    </Text>
                    <Text style={[styles.colCompany, styles.tdText]}>
                      {truncate(row.left?.company_name, 14)}
                    </Text>
                    {/* 右欄 */}
                    <Text style={[styles.colPos, styles.tdBold]}>
                      {row.right?.position_number || ''}
                    </Text>
                    <Text style={[styles.colName, styles.tdText]}>
                      {row.right?.customer_name || ''}
                    </Text>
                    <Text style={[styles.colCompany, styles.tdText]}>
                      {truncate(row.right?.company_name, 14)}
                    </Text>
                  </View>
                ))}

                {/* 空資料提示 */}
                {rows.length === 0 && (
                  <View style={[styles.tableRow, { padding: 20, justifyContent: 'center' }]}>
                    <Text style={{ color: '#999999', textAlign: 'center' }}>
                      尚無租戶資料
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* 頁尾 */}
        <View style={styles.footer}>
          <Text>Hour Jungle 商務中心 © {new Date().getFullYear()} | 此文件由系統自動生成</Text>
        </View>
      </Page>
    </Document>
  )
}

// 截斷文字
function truncate(text, maxLen) {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text
}
