import React, { useState, useRef, useEffect } from 'react';
import { generateContent, fileToBase64 } from './api';
import { Upload, Image as ImageIcon, Wand2, MousePointerSquareDashed, Download, ZoomIn, X, ChevronRight, RefreshCw, Edit3 } from 'lucide-react';

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState(null);
  
  const [previewImage, setPreviewImage] = useState(null);

  // -------------------------
  // 提示词状态
  // -------------------------
  const [step1Prompt, setStep1Prompt] = useState("根据这个图片空间信息，制作一张展示室内家具和局部空间设计的 3D 立体展示图，细致精确呈现其内部结构，并用中文注明空间名称，整体布局兼具专业性与视觉逻辑性，呈现出清晰、整洁的解析示意图，白色背景。");
  
  const [step2StylePrompt, setStep2StylePrompt] = useState("根据图片生成100字以内的装修风格描述");
  const [step2FixedPrompt, setStep2FixedPrompt] = useState("根据图2的设计风格，调整图1为等轴测、照片级真实感的房屋 3D 渲染图，严格保持墙体、空间和家具位置轮廓不变。装修设计风格参照图2，该图呈现新中式极简风格。以温润米色和原木为主调，巧妙融入山水挂画、禅意花艺等传统元素。家具线条干练现代，与古雅装饰交相辉映。空间氛围宁静深远，删繁就简中透出东方雅韵，是现代审美与传统底蕴的完美融合。");
  
  const [step4AreaPrompt, setStep4AreaPrompt] = useState("描述画面中红框部分的主要区域的画面内容，200字以内，不要有左右等绝对方位描述\n例如“斯堪的纳维亚风格的室内设计客厅，温馨而舒适，注重实用与美观的平衡。客厅里摆放着一张大的奶油色亚麻材质的 L 型沙发，它放置在浅米色的地毯上，对面是一张简约的浅色橡木木质电视柜。中央摆放着一张长方形的浅色木质咖啡桌。客厅外面是阳台，用落地式玻璃门隔开，让充足的自然光线涌入室内。铺设着浅橡木地板，墙壁涂成白色。”");
  const [step4FixedPrompt, setStep4FixedPrompt] = useState("任务：\n生成图2红框部分的真实摄影，空间布局严格遵守图2的平面设计图（严格保持墙体、空间和家具位置轮廓不变）。画面不要出现人物。\n\n画面要求：\n照片级真实感的 CGI 渲染风格（V-Ray / Corona），全局光照，高端摄影风格，线条干净，无畸变，具有细微的环境景深效果。");

  // -------------------------
  // 状态管理
  // -------------------------
  const [floorplanFile, setFloorplanFile] = useState(null);
  const [floorplanBase64, setFloorplanBase64] = useState(null);
  const [step1Results, setStep1Results] = useState([]);
  const [selectedStep1Image, setSelectedStep1Image] = useState(null);

  const [styleFile, setStyleFile] = useState(null);
  const [styleBase64, setStyleBase64] = useState(null);
  const [styleDesc, setStyleDesc] = useState('');
  const [step2Results, setStep2Results] = useState([]);
  const [selectedStep2Image, setSelectedStep2Image] = useState(null);

  const [annotatedImageBase64, setAnnotatedImageBase64] = useState(null);
  const [areaDesc, setAreaDesc] = useState('');

  const [finalConfig, setFinalConfig] = useState({ quality: '2K', ratio: '16:9' });
  const [finalResults, setFinalResults] = useState([]);
  
  // 第五步二次修改（图生图）
  const [selectedFinalImage, setSelectedFinalImage] = useState(null);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [refineConfig, setRefineConfig] = useState({ quality: '2K', ratio: '16:9' });

  // 解析 API 结果
  const parseImageResponse = (result) => {
    if (result.candidates && result.candidates[0]?.content?.parts) {
      return result.candidates[0].content.parts.map(p => {
        if (p.inlineData) return `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
        if (p.text) return p.text;
        return p;
      });
    }
    return [];
  };

  // 第一步：上传户型图，生成3D展示图 (1张)
  const handleStep1 = async () => {
    if (!floorplanFile) return;
    setLoading(true);
    setLoadingText('正在生成 3D 展示图 (2K画质, 16:9, 1张)...');
    setError(null);

    try {
      const b64 = await fileToBase64(floorplanFile);
      setFloorplanBase64(b64);
      
      const requestBody = {
        contents: [{
          parts: [
            { text: step1Prompt + "\n要求：2K高清画质。" },
            { inlineData: { mimeType: floorplanFile.type, data: b64 } }
          ]
        }],
        generationConfig: {
          numberOfImages: 1, // 改为 1 张
          aspectRatio: "16:9"
        }
      };

      const response = await generateContent('gemini-3.1-flash-image-preview', requestBody);
      const results = parseImageResponse(response);
      
      if (results.length === 0) throw new Error("生成结果为空，请检查接口返回");
      
      setStep1Results(results);
      setSelectedStep1Image(results[0]); // 默认选中第一张
      setCurrentStep(2);
      setMaxStepReached(prev => Math.max(prev, 2));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // 第二步：根据3D展示图生成3D渲染图 (1张)
  const handleStep2 = async () => {
    if (!selectedStep1Image || !styleFile) return;
    setLoading(true);
    setLoadingText('正在解析风格并生成 3D 渲染图...');
    setError(null);

    try {
      const styleB64 = await fileToBase64(styleFile);
      setStyleBase64(styleB64);

      const stylePromptBody = {
        contents: [{
          parts: [
            { text: step2StylePrompt },
            { inlineData: { mimeType: styleFile.type, data: styleB64 } }
          ]
        }]
      };
      
      let parsedStyleDesc = "";
      const styleRes = await generateContent('gemini-3.1-flash-lite-preview', stylePromptBody);
      if (styleRes.candidates && styleRes.candidates[0]?.content?.parts) {
        parsedStyleDesc = styleRes.candidates[0].content.parts[0].text;
      }
      setStyleDesc(parsedStyleDesc);

      const finalPrompt = step2FixedPrompt + "\n\n风格补充：" + parsedStyleDesc + "\n\n要求：2K高清画质。";

      let img1Base64 = selectedStep1Image;
      if (img1Base64.startsWith('data:')) {
        img1Base64 = img1Base64.split(',')[1];
      }

      const renderBody = {
        contents: [{
          parts: [
            { text: finalPrompt },
            { inlineData: { mimeType: 'image/jpeg', data: img1Base64 } },
            { inlineData: { mimeType: styleFile.type, data: styleB64 } }
          ]
        }],
        generationConfig: {
          numberOfImages: 1, // 改为 1 张
          aspectRatio: "16:9"
        }
      };

      const response = await generateContent('gemini-3.1-flash-image-preview', renderBody);
      const results = parseImageResponse(response);
      
      if (results.length === 0) throw new Error("渲染图生成结果为空");

      setStep2Results(results);
      setSelectedStep2Image(results[0]); // 默认选中第一张
      setCurrentStep(3);
      setMaxStepReached(prev => Math.max(prev, 3));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Next = () => {
    setCurrentStep(4);
    setMaxStepReached(prev => Math.max(prev, 4));
  };

  // 第四步：生成室内效果图 (1张)
  const handleStep4 = async () => {
    if (!annotatedImageBase64) return;
    setLoading(true);
    setLoadingText('正在解析标注区域并生成最终效果图...');
    setError(null);

    try {
      const annotatedB64Data = annotatedImageBase64.split(',')[1] || annotatedImageBase64;

      const areaPromptBody = {
        contents: [{
          parts: [
            { text: step4AreaPrompt },
            { inlineData: { mimeType: 'image/png', data: annotatedB64Data } }
          ]
        }]
      };
      
      let parsedAreaDesc = "";
      const areaRes = await generateContent('gemini-3.1-flash-lite-preview', areaPromptBody);
      if (areaRes.candidates) parsedAreaDesc = areaRes.candidates[0].content.parts[0].text;
      setAreaDesc(parsedAreaDesc);

      const finalPrompt = `${step4FixedPrompt}\n\n区域描述：\n${parsedAreaDesc}\n\n风格描述：\n${styleDesc}\n\n要求：${finalConfig.quality}画质。`;

      const finalBody = {
        contents: [{
          parts: [
            { text: finalPrompt },
            { inlineData: { mimeType: floorplanFile.type, data: floorplanBase64 } },
            { inlineData: { mimeType: 'image/png', data: annotatedB64Data } }
          ]
        }],
        generationConfig: {
          numberOfImages: 1, // 改为 1 张
          aspectRatio: finalConfig.ratio
        }
      };

      const response = await generateContent('gemini-3.1-flash-image-preview', finalBody);
      const results = parseImageResponse(response);
      
      if (results.length === 0) throw new Error("最终效果图生成失败");

      // 把新的结果放在最前面，并默认选中
      setFinalResults(prev => [results[0], ...prev]);
      setSelectedFinalImage(results[0]);
      
      setCurrentStep(5);
      setMaxStepReached(prev => Math.max(prev, 5));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // 第五步：二次修改生成（图生图）
  const handleRefine = async () => {
    if (!selectedFinalImage || !refinePrompt) return;
    setLoading(true);
    setLoadingText('正在进行图生图修改...');
    setError(null);

    try {
      let imgBase64 = selectedFinalImage;
      if (imgBase64.startsWith('data:')) {
        imgBase64 = imgBase64.split(',')[1];
      }

      const refineBody = {
        contents: [{
          parts: [
            { text: refinePrompt + `\n要求：${refineConfig.quality}画质。` },
            { inlineData: { mimeType: 'image/jpeg', data: imgBase64 } }
          ]
        }],
        generationConfig: {
          numberOfImages: 1,
          aspectRatio: refineConfig.ratio
        }
      };

      const response = await generateContent('gemini-3.1-flash-image-preview', refineBody);
      const results = parseImageResponse(response);
      
      if (results.length === 0) throw new Error("修改效果图生成失败");

      // 将新图追加到前面并选中
      setFinalResults(prev => [results[0], ...prev]);
      setSelectedFinalImage(results[0]);
      setRefinePrompt(''); // 清空提示词方便下次修改
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center space-x-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <Wand2 size={20} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">AI 智能户型优化工作流</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          {['1 上传户型图', '2 风格与渲染', '3 红框标注', '4 配置生成', '5 最终效果'].map((label, index) => {
            const step = index + 1;
            const isClickable = step <= maxStepReached;
            return (
              <div 
                key={step} 
                onClick={() => isClickable && setCurrentStep(step)}
                className={`flex items-center shrink-0 ${currentStep >= step ? 'text-blue-600' : 'text-gray-400'} ${isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`}
                title={isClickable ? '点击返回该步骤' : '尚未解锁该步骤'}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold transition-colors ${currentStep >= step ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
                  {step}
                </div>
                <span className="ml-2 font-medium hidden md:block">{label.substring(2)}</span>
                {step < 5 && <div className={`w-6 sm:w-12 lg:w-20 h-1 mx-2 ${currentStep > step ? 'bg-blue-600' : 'bg-gray-200'}`} />}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex flex-col">
            <strong className="mb-1">发生错误:</strong>
            <span className="whitespace-pre-wrap font-mono text-sm">{error}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10 min-h-[500px] relative">
          
          {loading && (
            <div className="absolute inset-0 bg-white/80 z-40 flex flex-col items-center justify-center rounded-2xl">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
              <p className="text-lg font-medium text-gray-800">{loadingText}</p>
              <p className="text-sm text-gray-500 mt-2">API 响应可能需要几十秒，请耐心等待...</p>
            </div>
          )}

          {/* Step 1: 上传户型图 */}
          {currentStep === 1 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">第一步：上传户型图</h2>
                <p className="text-gray-500">上传户型图以生成基础 3D 展示图 (默认生成: 2K画质, 16:9, 1张)</p>
              </div>
              
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center hover:border-blue-500 hover:bg-gray-50 transition-all overflow-hidden w-full">
                <input type="file" accept="image/*" onChange={e => setFloorplanFile(e.target.files[0])} className="hidden" id="upload-floorplan" />
                <label htmlFor="upload-floorplan" className="cursor-pointer flex flex-col items-center w-full">
                  {floorplanFile ? (
                    <div className="text-blue-600 font-medium text-center w-full px-4">
                      <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                      <div className="truncate w-full max-w-[280px] md:max-w-md mx-auto" title={floorplanFile.name}>
                        已选择: {floorplanFile.name}
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400 mb-3" />
                      <span className="text-lg font-medium">点击上传户型图</span>
                    </>
                  )}
                </label>
              </div>

              <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                <label className="block text-sm font-bold text-blue-800 mb-2">生成 3D 展示图提示词 (可编辑)：</label>
                <textarea 
                  value={step1Prompt}
                  onChange={e => setStep1Prompt(e.target.value)}
                  className="w-full p-3 border border-blue-200 rounded-lg text-sm text-gray-700 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] outline-none"
                />
              </div>

              <div className="flex gap-4 mt-6">
                {step1Results.length > 0 && (
                  <button 
                    onClick={() => setCurrentStep(2)} 
                    className="flex-1 py-3.5 bg-gray-100 text-gray-800 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center"
                  >
                    <span>保留结果，进入下一步</span>
                    <ChevronRight size={18} className="ml-1" />
                  </button>
                )}
                <button 
                  onClick={handleStep1} 
                  disabled={!floorplanFile}
                  className={`flex-1 py-3.5 rounded-xl font-medium transition-colors flex items-center justify-center disabled:bg-gray-300 disabled:cursor-not-allowed ${step1Results.length > 0 ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {step1Results.length > 0 ? (
                    <><RefreshCw size={18} className="mr-2" /> 重新生成 3D 展示图</>
                  ) : (
                    '开始生成 3D 展示图'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: 选图并上传风格图 */}
          {currentStep === 2 && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">第二步：确认 3D 展示图并上传风格图</h2>
                <p className="text-gray-500">已自动选中图1，请上传一张风格参考图（图2）以生成渲染图。</p>
              </div>
              
              <div className="flex flex-col md:flex-row gap-6 items-center md:items-stretch max-w-4xl mx-auto">
                <div className="w-full md:w-1/2">
                  <p className="font-bold text-gray-700 mb-2">已生成的 3D 展示图 (图1)：</p>
                  {step1Results.map((url, idx) => (
                    <div 
                      key={idx} 
                      className="relative rounded-lg overflow-hidden border-4 border-blue-600 shadow-lg group"
                    >
                      <img src={url} alt={`3D 展示图`} className="w-full h-auto object-cover aspect-video" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); setPreviewImage(url); }}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title="点击放大查看"
                      >
                        <ZoomIn size={18} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="w-full md:w-1/2">
                  <p className="font-bold text-gray-700 mb-2">上传风格参考图 (图2，必填)：</p>
                  <div className="h-full min-h-[200px] border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center hover:border-blue-500 hover:bg-gray-50 transition-all overflow-hidden w-full">
                    <input type="file" accept="image/*" onChange={e => setStyleFile(e.target.files[0])} className="hidden" id="upload-style" />
                    <label htmlFor="upload-style" className="cursor-pointer flex flex-col items-center w-full">
                      {styleFile ? (
                        <div className="text-blue-600 font-medium text-center w-full px-4">
                          <ImageIcon className="w-10 h-10 mx-auto mb-2" />
                          <div className="truncate w-full max-w-[200px] md:max-w-xs mx-auto" title={styleFile.name}>
                            风格图已选择: {styleFile.name}
                          </div>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-10 h-10 text-gray-400 mb-2" />
                          <span className="font-medium text-gray-700">点击上传图片</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 space-y-4 max-w-4xl mx-auto">
                <div>
                  <label className="block text-sm font-bold text-blue-800 mb-2">风格解析提示词 (解析上传的风格图)：</label>
                  <textarea 
                    value={step2StylePrompt}
                    onChange={e => setStep2StylePrompt(e.target.value)}
                    className="w-full p-2 border border-blue-200 rounded-lg text-sm text-gray-700 focus:ring-blue-500 focus:border-blue-500 min-h-[40px] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-blue-800 mb-2">生成 3D 渲染图 固定提示词 (与风格解析结果合并)：</label>
                  <textarea 
                    value={step2FixedPrompt}
                    onChange={e => setStep2FixedPrompt(e.target.value)}
                    className="w-full p-3 border border-blue-200 rounded-lg text-sm text-gray-700 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] outline-none"
                  />
                </div>
                {/* 生成后暴露解析出的风格描述 */}
                {styleDesc && (
                  <div className="pt-4 border-t border-blue-200">
                    <label className="block text-sm font-bold text-green-700 mb-2">🚀 已解析的风格描述 (用于生成)：</label>
                    <div className="w-full p-3 bg-white border border-green-200 rounded-lg text-sm text-gray-800 shadow-inner whitespace-pre-wrap">
                      {styleDesc}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-6 max-w-4xl mx-auto">
                {step2Results.length > 0 && (
                  <button 
                    onClick={() => setCurrentStep(3)} 
                    className="flex-1 py-3.5 bg-gray-100 text-gray-800 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center"
                  >
                    <span>保留结果，进入下一步</span>
                    <ChevronRight size={18} className="ml-1" />
                  </button>
                )}
                <button 
                  onClick={handleStep2} 
                  disabled={!selectedStep1Image || !styleFile}
                  className={`flex-1 py-3.5 rounded-xl font-medium transition-colors flex items-center justify-center disabled:bg-gray-300 disabled:cursor-not-allowed ${step2Results.length > 0 ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {step2Results.length > 0 ? (
                    <><RefreshCw size={18} className="mr-2" /> 重新生成 3D 渲染图</>
                  ) : (
                    '生成 3D 渲染图'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: 标注红框 */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">第三步：在 3D 渲染图上进行红框标注</h2>
                <p className="text-gray-500">已自动选中渲染图，请在图上拖拽画出一个红色矩形框，用于重点室内效果生成。</p>
              </div>

              <div className="max-w-4xl mx-auto mb-6">
                {selectedStep2Image && (
                  <CanvasAnnotator 
                    imageUrl={selectedStep2Image} 
                    onSave={setAnnotatedImageBase64} 
                  />
                )}
              </div>

              <button 
                onClick={handleStep3Next} 
                disabled={!annotatedImageBase64 || !selectedStep2Image}
                className="w-full max-w-4xl mx-auto block py-3.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed mt-4"
              >
                确认标注并进入下一步
              </button>
            </div>
          )}

          {/* Step 4: 配置并生成最终效果 */}
          {currentStep === 4 && (
            <div className="space-y-8 max-w-4xl mx-auto">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">第四步：生成室内效果图</h2>
                <p className="text-gray-500">确认已上传的素材并配置输出参数，系统将自动解析您的标注区域并结合风格进行渲染。</p>
              </div>

              {/* 展示前置步骤的图片 (图1和图2) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <p className="font-bold text-gray-700 mb-3 text-center">图1：原始户型图</p>
                  <div className="relative rounded-lg overflow-hidden border border-gray-300 group">
                    <img 
                      src={floorplanFile ? URL.createObjectURL(floorplanFile) : ''} 
                      alt="原始户型图" 
                      className="w-full h-48 object-cover bg-white" 
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setPreviewImage(floorplanFile ? URL.createObjectURL(floorplanFile) : ''); }}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="点击放大查看"
                    >
                      <ZoomIn size={18} />
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <p className="font-bold text-gray-700 mb-3 text-center">图2：标注后的 3D 渲染图</p>
                  <div className="relative rounded-lg overflow-hidden border border-gray-300 group">
                    <img 
                      src={annotatedImageBase64} 
                      alt="标注后的 3D 渲染图" 
                      className="w-full h-48 object-cover bg-white" 
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setPreviewImage(annotatedImageBase64); }}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="点击放大查看"
                    >
                      <ZoomIn size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-xl border border-gray-200">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">生成画质</label>
                  <select 
                    value={finalConfig.quality} 
                    onChange={e => setFinalConfig({...finalConfig, quality: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 outline-none"
                  >
                    <option value="1K">1K</option>
                    <option value="2K">2K</option>
                    <option value="4K">4K</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">图片比例</label>
                  <select 
                    value={finalConfig.ratio} 
                    onChange={e => setFinalConfig({...finalConfig, ratio: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 outline-none"
                  >
                    <option value="1:1">1:1</option>
                    <option value="16:9">16:9</option>
                    <option value="4:3">4:3</option>
                    <option value="9:16">9:16</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-blue-800 mb-2">区域解析提示词 (解析红框区域内容)：</label>
                  <textarea 
                    value={step4AreaPrompt}
                    onChange={e => setStep4AreaPrompt(e.target.value)}
                    className="w-full p-3 border border-blue-200 rounded-lg text-sm text-gray-700 focus:ring-blue-500 min-h-[100px] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-blue-800 mb-2">最终效果 固定提示词：</label>
                  <textarea 
                    value={step4FixedPrompt}
                    onChange={e => setStep4FixedPrompt(e.target.value)}
                    className="w-full p-3 border border-blue-200 rounded-lg text-sm text-gray-700 focus:ring-blue-500 min-h-[100px] outline-none"
                  />
                </div>
                {/* 暴露步骤2的风格提示词 */}
                {styleDesc && (
                  <div className="pt-4 border-t border-blue-200">
                    <label className="block text-sm font-bold text-purple-700 mb-2">🎨 风格描述参考 (来自步骤二)：</label>
                    <div className="w-full p-3 bg-white border border-purple-200 rounded-lg text-sm text-gray-800 shadow-inner">
                      {styleDesc}
                    </div>
                  </div>
                )}
                {/* 暴露步骤4的区域提示词 */}
                {areaDesc && (
                  <div className="pt-4 border-t border-blue-200">
                    <label className="block text-sm font-bold text-green-700 mb-2">🎯 解析出的区域描述：</label>
                    <div className="w-full p-3 bg-white border border-green-200 rounded-lg text-sm text-gray-800 shadow-inner">
                      {areaDesc}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-6">
                {finalResults.length > 0 && (
                  <button 
                    onClick={() => setCurrentStep(5)} 
                    className="flex-1 py-3.5 bg-gray-100 text-gray-800 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center"
                  >
                    <span>保留结果，查看最终效果</span>
                    <ChevronRight size={18} className="ml-1" />
                  </button>
                )}
                <button 
                  onClick={handleStep4} 
                  className={`flex-1 py-3.5 rounded-xl font-bold text-lg shadow-md transition-colors flex items-center justify-center ${finalResults.length > 0 ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {finalResults.length > 0 ? (
                    <><RefreshCw size={18} className="mr-2" /> 重新生成室内效果图</>
                  ) : (
                    '生成室内效果图'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: 最终展示与二次修改 */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">🎉 最终室内效果图</h2>
                <p className="text-gray-500">点击下方图片可将其选中，以便在最下方进行【图生图】二次修改。</p>
              </div>

              {/* 展示所有生成的最终结果（包含图生图新增的） */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {finalResults.map((url, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedFinalImage(url)}
                    className={`relative cursor-pointer rounded-xl overflow-hidden shadow-sm border-4 transition-all group ${selectedFinalImage === url ? 'border-blue-600' : 'border-transparent hover:border-gray-300'}`}
                  >
                    <img src={url} alt={`最终效果图 ${idx}`} className="w-full h-auto object-cover aspect-video" />
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); setPreviewImage(url); }}
                      className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="全屏放大查看"
                    >
                      <ZoomIn size={20} />
                    </button>

                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <a href={url} download={`final-result-${idx}.jpg`} onClick={e => e.stopPropagation()} className="pointer-events-auto bg-white text-gray-900 px-4 py-2 rounded-full font-medium shadow-lg flex items-center space-x-2 hover:bg-blue-50 transition-colors">
                        <Download size={16} />
                        <span>下载</span>
                      </a>
                    </div>
                    {selectedFinalImage === url && (
                      <div className="absolute inset-0 bg-blue-600/10 pointer-events-none border-4 border-blue-600"></div>
                    )}
                  </div>
                ))}
              </div>

              {/* 二次修改（图生图）面板 */}
              {selectedFinalImage && (
                <div className="mt-10 bg-gray-50 p-6 md:p-8 rounded-2xl border border-gray-200 space-y-6">
                  <div className="flex items-center space-x-2 mb-4 text-blue-800">
                    <Edit3 size={24} />
                    <h3 className="text-xl font-bold">对选中的图片进行二次修改 (图生图)</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">修改画质</label>
                      <select 
                        value={refineConfig.quality} 
                        onChange={e => setRefineConfig({...refineConfig, quality: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 outline-none bg-white"
                      >
                        <option value="1K">1K</option>
                        <option value="2K">2K</option>
                        <option value="4K">4K</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">修改比例</label>
                      <select 
                        value={refineConfig.ratio} 
                        onChange={e => setRefineConfig({...refineConfig, ratio: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 outline-none bg-white"
                      >
                        <option value="1:1">1:1 (正方形)</option>
                        <option value="16:9">16:9 (横屏宽幅)</option>
                        <option value="4:3">4:3 (标准横屏)</option>
                        <option value="9:16">9:16 (竖屏)</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">修改提示词</label>
                    <textarea 
                      value={refinePrompt} 
                      onChange={e => setRefinePrompt(e.target.value)} 
                      placeholder="例如：将沙发换成真皮材质，墙壁颜色改为浅蓝色..." 
                      className="w-full p-4 border border-gray-300 rounded-xl min-h-[120px] focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <button 
                    onClick={handleRefine} 
                    disabled={!refinePrompt} 
                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors shadow-md"
                  >
                    生成修改后的效果图
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 sm:p-8 backdrop-blur-sm transition-opacity"
          onClick={() => setPreviewImage(null)}
        >
          <button 
            className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white/70 hover:text-white p-2 bg-black/50 rounded-full transition-colors"
            onClick={() => setPreviewImage(null)}
          >
            <X size={32} />
          </button>
          <img 
            src={previewImage} 
            alt="大图预览" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// 独立的 Canvas 标注组件
function CanvasAnnotator({ imageUrl, onSave }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [rect, setRect] = useState(null);
  const [startPos, setStartPos] = useState(null);
  const [imageObj, setImageObj] = useState(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = () => {
      setImageObj(img);
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!imageObj || !containerRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = imageObj.width;
    canvas.height = imageObj.height;
    ctx.drawImage(imageObj, 0, 0);
    onSave(canvas.toDataURL('image/png'));
  }, [imageObj, onSave]);

  const drawRect = (currentRect) => {
    if (!imageObj) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageObj, 0, 0);
    if (currentRect) {
      ctx.strokeStyle = 'red';
      ctx.lineWidth = Math.max(4, canvas.width / 200);
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
    }
    onSave(canvas.toDataURL('image/png'));
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e) => {
    const pos = getMousePos(e);
    setIsDrawing(true);
    setStartPos(pos);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !imageObj) return;
    const pos = getMousePos(e);
    const newRect = {
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      w: Math.abs(pos.x - startPos.x),
      h: Math.abs(pos.y - startPos.y)
    };
    setRect(newRect);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageObj, 0, 0);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = Math.max(4, canvas.width / 200);
    ctx.strokeRect(newRect.x, newRect.y, newRect.w, newRect.h);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    if (rect) {
      drawRect(rect);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 flex items-center text-sm font-bold text-red-600 bg-red-50 px-4 py-2 rounded-full">
        <MousePointerSquareDashed size={18} className="mr-2" />
        按住鼠标在图片上拖拽，画出红色矩形框
      </div>
      <div ref={containerRef} className="w-full max-w-4xl border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-100 cursor-crosshair relative shadow-inner">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-auto block"
        />
      </div>
    </div>
  );
}

export default App;
