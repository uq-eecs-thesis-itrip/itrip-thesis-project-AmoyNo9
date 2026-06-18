/** @type {import('tailwindcss').Config} */
module.exports = {
  corePlugins: {
    preflight: false, // 解决与MUI样式冲突
  },
  content: [
    "./src/**/*.{js,jsx}", // 扫描所有React文件
  ],
  theme: {
    extend: {
      // 自定义颜色：贴合厦门旅游（海洋蓝、美食橙、文化红、清新绿）
      colors: {
        primary: '#1E88E5', // 主色：海洋蓝（匹配厦门海滨属性）
        scenery: '#4CAF50', // 风景场景色：清新绿
        cuisine: '#FF9800', // 美食场景色：活力橙
        culture: '#E53935', // 文化场景色：文化红
        neutral: '#F5F7FA', // 背景色：浅灰
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'], // 适配旅游界面清晰字体
      },
    },
  },
  plugins: [],
}