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

// 註冊中文字體（使用 Google Fonts CDN）
Font.register({
  family: 'NotoSansTC',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/notosanstc/v35/-nFuOG829Oofr2wohFbTp9ifNAn722rq0MXz76Cy_CpOtma3uNQ.ttf',
      fontWeight: 'normal'
    },
    {
      src: 'https://fonts.gstatic.com/s/notosanstc/v35/-nFuOG829Oofr2wohFbTp9ifNAn722rq0MXz7_-x_CpOtma3uNQ.ttf',
      fontWeight: 'bold'
    }
  ]
})

// 樣式定義
const styles = StyleSheet.create({
  // 第一頁：平面圖
  pagePlan: {
    fontFamily: 'NotoSansTC',
    fontSize: 10,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c5530'
  },
  subtitle: {
    fontSize: 10,
    color: '#666666',
    marginTop: 3
  },
  date: {
    fontSize: 9,
    color: '#999999',
    marginTop: 2
  },
  // 平面圖區域
  floorPlanContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  floorPlanImage: {
    maxWidth: '100%',
    maxHeight: '90%',
    objectFit: 'contain'
  },
  // 圖例
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    gap: 20
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  legendBox: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 2,
    marginRight: 5
  },
  legendOccupied: {
    backgroundColor: '#ffffff'
  },
  legendVacant: {
    backgroundColor: '#f0f0f0'
  },
  legendText: {
    fontSize: 9
  },
  // 第二頁：表格
  pageTable: {
    fontFamily: 'NotoSansTC',
    fontSize: 9,
    padding: 30,
    backgroundColor: '#ffffff'
  },
  tableHeader: {
    backgroundColor: '#2c5530',
    padding: 10,
    marginBottom: 0
  },
  tableHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center'
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#dddddd'
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
    padding: 6,
    textAlign: 'center',
    fontWeight: 'bold',
    borderRightWidth: 1,
    borderRightColor: '#eeeeee'
  },
  colName: {
    width: '17%',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#eeeeee'
  },
  colCompany: {
    width: '25%',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#eeeeee'
  },
  thText: {
    fontWeight: 'bold',
    fontSize: 9
  },
  tdText: {
    fontSize: 9
  },
  tdBold: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#2c5530'
  },
  // 頁尾
  footer: {
    marginTop: 'auto',
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
    paddingTop: 10,
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
      {/* 第一頁：平面圖 */}
      <Page size="A4" orientation="landscape" style={styles.pagePlan}>
        <View style={styles.header}>
          <Text style={styles.title}>{floor_plan.name || '大忠本館'} 租戶配置圖</Text>
          <Text style={styles.subtitle}>Hour Jungle 商務中心</Text>
          <Text style={styles.date}>製表日期：{formatDate()}</Text>
        </View>

        <View style={styles.floorPlanContainer}>
          {floorPlanImage ? (
            <Image src={floorPlanImage} style={styles.floorPlanImage} />
          ) : (
            <Text style={{ color: '#999' }}>平面圖載入中...</Text>
          )}
        </View>

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

        <View style={styles.footer}>
          <Text>Hour Jungle 商務中心 © {new Date().getFullYear()} | 此文件由系統自動生成</Text>
        </View>
      </Page>

      {/* 第二頁：租戶表格 */}
      <Page size="A4" orientation="portrait" style={styles.pageTable}>
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
            <Text style={[styles.colCompany, { ...styles.thText, borderRightWidth: 0 }]}>公司名稱</Text>
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
                {truncate(row.left?.customer_name, 8)}
              </Text>
              <Text style={[styles.colCompany, styles.tdText]}>
                {truncate(row.left?.company_name, 12)}
              </Text>
              {/* 右欄 */}
              <Text style={[styles.colPos, styles.tdBold]}>
                {row.right?.position_number || ''}
              </Text>
              <Text style={[styles.colName, styles.tdText]}>
                {truncate(row.right?.customer_name, 8)}
              </Text>
              <Text style={[styles.colCompany, { ...styles.tdText, borderRightWidth: 0 }]}>
                {truncate(row.right?.company_name, 12)}
              </Text>
            </View>
          ))}

          {/* 空資料提示 */}
          {rows.length === 0 && (
            <View style={[styles.tableRow, { padding: 20, justifyContent: 'center' }]}>
              <Text style={{ color: '#999999', textAlign: 'center', width: '100%' }}>
                尚無租戶資料
              </Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text>Hour Jungle 商務中心 © {new Date().getFullYear()} | 此文件由系統自動生成</Text>
        </View>
      </Page>
    </Document>
  )
}
