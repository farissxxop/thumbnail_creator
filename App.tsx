
import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { TextInput } from './components/TextInput';
import { Button } from './components/Button';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ThumbnailCard } from './components/ThumbnailCard';
import { generateThumbnails, generateDescriptionFromVideoInfo, getCreativePromptSuggestions } from './services/geminiService';
import type { ThumbnailData, ArtisticStyle } from './types';

const YOUTUBE_VIDEO_ID_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;

const ExtractYouTubeVideoInfoIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
    <path fillRule="evenodd" d="M9.664 1.319a.75.75 0 0 1 .672 0l6.25 3.557a.75.75 0 0 1 .335.902l-.912 3.241a.75.75 0 0 1-1.352-.38l.668-2.372-5.281-3.006a.75.75 0 0 0-.672 0L3.715 5.26l.668 2.372a.75.75 0 0 1-1.352.38L2.12 6.777a.75.75 0 0 1 .335-.902l6.25-3.557Z" clipRule="evenodd" />
    <path fillRule="evenodd" d="M2 9.833c0 .414.336.75.75.75h14.5a.75.75 0 0 0 .75-.75v-1.5a.75.75 0 0 0-.75-.75H2.75a.75.75 0 0 0-.75.75v1.5Zm0 3.417c0 .414.336.75.75.75h14.5a.75.75 0 0 0 .75-.75v-1.5a.75.75 0 0 0-.75-.75H2.75a.75.75 0 0 0-.75.75v1.5Z" clipRule="evenodd" />
  </svg>
);

const SparklesIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${className}`}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L1.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L24 5.25l-.813 2.846a4.5 4.5 0 0 0-3.09 3.09L18.25 12ZM18.25 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09L12 18.75l.813-2.846a4.5 4.5 0 0 0 3.09-3.09L18.25 12Z" />
    </svg>
);


const availableStyles: ArtisticStyle[] = [
  { id: 'cinematic', name: 'Cinematic' },
  { id: 'illustrative', name: 'Illustrative' },
  { id: 'futuristic', name: 'Futuristic' },
  { id: 'minimalist', name: 'Minimalist' },
  { id: 'photorealistic', name: 'Photorealistic' },
  { id: 'vintage', name: 'Vintage' },
  { id: '3d-render', name: '3D Render' },
  { id: 'cartoonish', name: 'Cartoonish' },
];

const App: React.FC = () => {
  const [youtubeLink, setYoutubeLink] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [selectedStyles, setSelectedStyles] = useState<Set<ArtisticStyle['id']>>(new Set());
  const [numImages, setNumImages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedThumbnails, setGeneratedThumbnails] = useState<ThumbnailData[]>([]);

  const [isAnalyzingLink, setIsAnalyzingLink] = useState<boolean>(false);
  const [linkAnalysisError, setLinkAnalysisError] = useState<string | null>(null);

  const [isSuggestingPrompts, setIsSuggestingPrompts] = useState<boolean>(false);
  const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);
  const [promptSuggestionError, setPromptSuggestionError] = useState<string | null>(null);

  const handleAnalyzeVideoLink = useCallback(async () => {
    if (!youtubeLink.trim()) {
      setLinkAnalysisError('Please enter a YouTube video link.');
      return;
    }
    setLinkAnalysisError(null);
    setPromptSuggestions([]);
    setPromptSuggestionError(null);
    setIsAnalyzingLink(true);
    setDescription(''); 

    try {
      const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeLink)}&format=json`;
      const oEmbedResponse = await fetch(oEmbedUrl);

      if (!oEmbedResponse.ok) {
        if (oEmbedResponse.status === 404) throw new Error(`Could not fetch video details. Is the link correct and public? (Status: ${oEmbedResponse.status})`);
        if (oEmbedResponse.status === 401 || oEmbedResponse.status === 403) throw new Error(`Video is private or embedding is restricted. (Status: ${oEmbedResponse.status})`);
        throw new Error(`Failed to fetch video details. Status: ${oEmbedResponse.status}`);
      }

      const videoData = await oEmbedResponse.json();
      const videoTitle = videoData.title;
      const videoAuthor = videoData.author_name;

      if (!videoTitle) throw new Error('Could not extract video title.');

      const generatedDesc = await generateDescriptionFromVideoInfo(videoTitle, videoAuthor);
      setDescription(generatedDesc);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during link analysis.';
      setLinkAnalysisError(errorMessage);
      console.error('Link analysis error:', err);
    } finally {
      setIsAnalyzingLink(false);
    }
  }, [youtubeLink]);

  const handleSuggestCreativePrompts = useCallback(async () => {
    if (!description.trim()) {
      setPromptSuggestionError('Please enter a description first, or analyze a video link to generate one.');
      return;
    }
    setIsSuggestingPrompts(true);
    setPromptSuggestions([]);
    setPromptSuggestionError(null);
    try {
      const suggestions = await getCreativePromptSuggestions(description);
      setPromptSuggestions(suggestions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while suggesting prompts.';
      setPromptSuggestionError(errorMessage);
      console.error('Prompt suggestion error:', err);
    } finally {
      setIsSuggestingPrompts(false);
    }
  }, [description]);

  const handleStyleToggle = (styleId: ArtisticStyle['id']) => {
    setSelectedStyles(prevStyles => {
      const newStyles = new Set(prevStyles);
      if (newStyles.has(styleId)) {
        newStyles.delete(styleId);
      } else {
        newStyles.add(styleId);
      }
      return newStyles;
    });
  };
  
  const handleSubmit = useCallback(async () => {
    if (!description.trim()) {
      setError('Please provide a description for the thumbnail (or analyze a YouTube link).');
      return;
    }
    setError(null);
    setLinkAnalysisError(null);
    setPromptSuggestionError(null);
    setIsLoading(true);
    setGeneratedThumbnails([]);

    const activeStyleNames = availableStyles
      .filter(style => selectedStyles.has(style.id))
      .map(style => style.name);

    try {
      const imageBase64Strings = await generateThumbnails({
        description: description,
        numberOfImages: numImages,
        aspectRatio: '16:9',
        styles: activeStyleNames,
      });
      
      const thumbnailData: ThumbnailData[] = imageBase64Strings.map((url, index) => ({
        id: `thumb-${Date.now()}-${index}`,
        url: url,
        altText: `Generated Thumbnail ${index + 1} for: ${description.substring(0, 30)}... ${activeStyleNames.join(', ')}`,
      }));
      setGeneratedThumbnails(thumbnailData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while generating thumbnails.';
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [description, numImages, selectedStyles]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 text-slate-100 flex flex-col items-center p-4 sm:p-6 selection:bg-sky-500 selection:text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Header />
      <main className="w-full max-w-3xl space-y-10 mt-8 mb-16 flex-grow">
        <div className="bg-slate-800/70 backdrop-blur-lg shadow-2xl rounded-xl p-6 sm:p-8 space-y-6 border border-slate-700">
          
          {/* YouTube Link Analysis */}
          <section aria-labelledby="youtube-link-section">
            <h2 id="youtube-link-section" className="text-lg font-semibold text-sky-300 mb-2">Analyze Video (Optional)</h2>
            <label htmlFor="youtubeLink" className="block text-sm font-medium text-slate-300 mb-1.5">
              Paste YouTube Video Link
            </label>
            <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0">
              <TextInput
                id="youtubeLink"
                type="url"
                value={youtubeLink}
                onChange={(e) => { setYoutubeLink(e.target.value); setLinkAnalysisError(null); }}
                placeholder="e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                className="bg-slate-700/60 border-slate-600 focus:border-sky-500 focus:ring-sky-500 flex-grow"
                aria-describedby="linkAnalysisError"
              />
              <Button
                onClick={handleAnalyzeVideoLink}
                disabled={isAnalyzingLink || !youtubeLink.trim()}
                className="bg-teal-600 hover:bg-teal-500 disabled:bg-slate-600 text-white whitespace-nowrap px-4 py-3 sm:py-0 text-sm"
                aria-label="Analyze YouTube video link and suggest description"
              >
                {isAnalyzingLink ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin"></div>
                    <span>Analyzing...</span>
                  </div>
                ) : (
                  <>
                    <ExtractYouTubeVideoInfoIcon />
                    <span>Analyze & Suggest Description</span>
                  </>
                )}
              </Button>
            </div>
            {linkAnalysisError && (
              <p id="linkAnalysisError" className="text-xs text-red-400 mt-1.5" role="alert">
                {linkAnalysisError}
              </p>
            )}
             <p className="text-xs text-slate-400 mt-1.5">
              Helps auto-fill the description below based on video content.
            </p>
          </section>

          {/* Thumbnail Description */}
          <section aria-labelledby="description-section">
            <h2 id="description-section" className="text-lg font-semibold text-sky-300 mb-2">Describe Your Thumbnail</h2>
            <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-1.5">
              AI Prompt <span className="text-red-400">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setError(null); setPromptSuggestionError(null); }}
              placeholder="e.g., A surprised cat looking at a complex algorithm on a glowing computer screen, vibrant colors, futuristic style."
              rows={4}
              className="w-full p-3 bg-slate-700/60 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors text-slate-100 placeholder-slate-400 resize-none"
              required
              aria-label="Describe the thumbnail or let AI suggest based on video link"
            />
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-slate-400 self-start sm:self-center">
                    Detailed descriptions yield better results.
                </p>
                <Button
                    onClick={handleSuggestCreativePrompts}
                    disabled={isSuggestingPrompts || !description.trim()}
                    className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 text-white text-sm px-4 py-2"
                    aria-label="Get creative prompt suggestions from AI"
                >
                    {isSuggestingPrompts ? (
                        <div className="flex items-center justify-center space-x-2">
                            <div className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin"></div>
                            <span>Inspiring...</span>
                        </div>
                    ) : (
                        <>
                            <SparklesIcon />
                            <span>Suggest Creative Twists</span>
                        </>
                    )}
                </Button>
            </div>
            {promptSuggestionError && (
              <p className="text-xs text-red-400 mt-1.5" role="alert">{promptSuggestionError}</p>
            )}
            {promptSuggestions.length > 0 && !isSuggestingPrompts && (
              <div className="mt-4 space-y-2 p-3 bg-slate-700/50 rounded-md">
                <h3 className="text-sm font-medium text-sky-300">Creative Suggestions:</h3>
                {promptSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {setDescription(suggestion); setPromptSuggestions([]);}}
                    className="w-full text-left p-2 text-xs bg-slate-600 hover:bg-sky-600 rounded transition-colors text-slate-200 hover:text-white"
                    title="Click to use this suggestion"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </section>
          
          {/* Artistic Styles */}
          <section aria-labelledby="style-section">
            <h2 id="style-section" className="text-lg font-semibold text-sky-300 mb-3">Artistic Style (Optional)</h2>
            <div className="flex flex-wrap gap-2">
              {availableStyles.map(style => (
                <button
                  key={style.id}
                  onClick={() => handleStyleToggle(style.id)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-all duration-150
                    ${selectedStyles.has(style.id) 
                      ? 'bg-sky-500 border-sky-400 text-white shadow-md' 
                      : 'bg-slate-700/60 border-slate-600 hover:bg-slate-600/80 hover:border-slate-500 text-slate-200'}`}
                  aria-pressed={selectedStyles.has(style.id)}
                >
                  {style.name}
                </button>
              ))}
            </div>
          </section>

          {/* Number of Images */}
          <section aria-labelledby="settings-section">
            <h2 id="settings-section" className="text-lg font-semibold text-sky-300 mb-2">Settings</h2>
            <label htmlFor="numImages" className="block text-sm font-medium text-slate-300 mb-1.5">
              Number of Thumbnails
            </label>
            <select
              id="numImages"
              value={numImages}
              onChange={(e) => setNumImages(parseInt(e.target.value, 10))}
              className="w-full p-3 bg-slate-700/60 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors text-slate-100"
            >
              <option value={1}>1 Image</option>
              <option value={2}>2 Images</option>
              <option value={3}>3 Images</option>
              <option value={4}>4 Images</option>
              <option value={5}>5 Images</option>
            </select>
          </section>

          <Button
            onClick={handleSubmit}
            disabled={isLoading || !description.trim()}
            className="w-full text-lg py-3 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 disabled:from-slate-600 disabled:to-slate-700 disabled:text-slate-400 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.01] transition-all duration-200"
            aria-live="polite"
          >
            {isLoading ? <LoadingSpinner /> : '✨ Generate Thumbnails'}
          </Button>
        </div>

        {error && (
          <div className="bg-red-900/60 border border-red-700 text-red-300 p-4 rounded-lg shadow-md text-center" role="alert">
            <p className="font-semibold text-red-200">Error Generating Thumbnails:</p>
            <p>{error}</p>
          </div>
        )}

        {generatedThumbnails.length > 0 && (
          <section className="mt-12" aria-labelledby="generated-thumbnails-heading">
            <h2 id="generated-thumbnails-heading" className="text-3xl font-bold text-sky-400 mb-8 text-center tracking-tight" style={{fontFamily: "'Lexend', sans-serif"}}>
              Your AI-Generated Thumbnails
            </h2>
            <div className={`grid grid-cols-1 ${generatedThumbnails.length > 1 ? 'sm:grid-cols-2' : ''} gap-6 sm:gap-8`}>
              {generatedThumbnails.map((thumb) => (
                <ThumbnailCard key={thumb.id} imageUrl={thumb.url} altText={thumb.altText} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default App;
