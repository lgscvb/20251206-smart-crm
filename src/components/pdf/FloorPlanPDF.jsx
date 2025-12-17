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

// 樣式定義 - 橫向 A4，左邊平面圖，右邊表格
const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansTC',
    fontSize: 8,
    padding: 20,
    backgroundColor: '#ffffff'
  },
  header: {
    textAlign: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#2c5530'
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c5530'
  },
  subtitle: {
    fontSize: 9,
    color: '#666666',
    marginTop: 3
  },
  date: {
    fontSize: 8,
    color: '#999999',
    marginTop: 2
  },
  // 主要佈局：左右分欄
  mainContent: {
    flexDirection: 'row',
    flex: 1
  },
  // 左側：平面圖
  leftSection: {
    width: '60%',
    paddingRight: 10
  },
  // 右側：統計 + 表格
  rightSection: {
    width: '40%'
  },
  // 平面圖圖片
  floorPlanImage: {
    width: '100%',
    objectFit: 'contain',
    border: '1px solid #ddd'
  },
  // 圖例
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 5,
    gap: 15
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  legendBox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 2,
    marginRight: 4
  },
  legendOccupied: {
    backgroundColor: '#ffffff'
  },
  legendVacant: {
    backgroundColor: '#f0f0f0'
  },
  legendText: {
    fontSize: 7
  },
  // 統計區
  statsBox: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    padding: 8,
    marginBottom: 8
  },
  statsTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2c5530',
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#2c5530'
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  statItem: {
    width: '50%',
    backgroundColor: '#ffffff',
    padding: 6,
    borderWidth: 1,
    borderColor: '#eeeeee',
    textAlign: 'center'
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c5530'
  },
  statLabel: {
    fontSize: 7,
    color: '#666666',
    marginTop: 2
  },
  // 租戶表格
  tableWrapper: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    flex: 1
  },
  tableHeader: {
    backgroundColor: '#2c5530',
    padding: 6
  },
  tableHeaderText: {
    fontSize: 9,
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
    width: '12%',
    padding: 3,
    textAlign: 'center',
    fontWeight: 'bold'
  },
  colName: {
    width: '22%',
    padding: 3
  },
  colCompany: {
    width: '28%',
    padding: 3
  },
  // 分隔線
  colDivider: {
    width: '1%',
    backgroundColor: '#eeeeee'
  },
  thText: {
    fontWeight: 'bold',
    fontSize: 7
  },
  tdText: {
    fontSize: 7
  },
  tdBold: {
    fontSize: 7,
    fontWeight: 'bold'
  },
  // 頁尾
  footer: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 7,
    color: '#999999',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#eeeeee'
  }
})

// 格式化日期
const formatDate = () => {
  const now = new Date()
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
}

// 截斷文字
function truncate(text, maxLen) {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text
}

// 平面圖 PDF 元件
export default function FloorPlanPDF({ data }) {
  const {
    floor_plan = {},
    positions = [],
    statistics = {},
    floorPlanImage = null
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
          {/* 左側：平面圖 */}
          <View style={styles.leftSection}>
            {floorPlanImage ? (
              <Image src={floorPlanImage} style={styles.floorPlanImage} />
            ) : (
              <View style={{ backgroundColor: '#f5f5f5', height: 300, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#999' }}>平面圖載入中...</Text>
              </View>
            )}

            {/* 圖例 */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, styles.legendOccupied]} />
                <Text style={styles.legendText}>已租用</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, styles.legendVacant]} />
                <Text style={styles.legendText}>空位</Text>
              </View>
            </View>
          </View>

          {/* 右側：統計 + 表格 */}
          <View style={styles.rightSection}>
            {/* 統計區 */}
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

            {/* 租戶表格 */}
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
                  <View style={styles.colDivider} />
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
                      {truncate(row.left?.customer_name, 6)}
                    </Text>
                    <Text style={[styles.colCompany, styles.tdText]}>
                      {truncate(row.left?.company_name, 10)}
                    </Text>
                    <View style={styles.colDivider} />
                    {/* 右欄 */}
                    <Text style={[styles.colPos, styles.tdBold]}>
                      {row.right?.position_number || ''}
                    </Text>
                    <Text style={[styles.colName, styles.tdText]}>
                      {truncate(row.right?.customer_name, 6)}
                    </Text>
                    <Text style={[styles.colCompany, styles.tdText]}>
                      {truncate(row.right?.company_name, 10)}
                    </Text>
                  </View>
                ))}

                {/* 空資料提示 */}
                {rows.length === 0 && (
                  <View style={[styles.tableRow, { padding: 15, justifyContent: 'center' }]}>
                    <Text style={{ color: '#999999', textAlign: 'center', width: '100%' }}>
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
