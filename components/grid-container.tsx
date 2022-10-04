import 'react-grid-layout/css/styles.css'
import GridLayout from "react-grid-layout"
import {Editor, EditorState, ContentState, convertFromRaw } from 'draft-js';
import 'draft-js/dist/Draft.css';
import styles from '../styles/components/StepAdmin.module.sass'
import {blockStyleFn} from '../utils/common.tsx'


const GridContainer = ({ layout, layoutContent, contentFormatting }) => {
    return <div>
        {layout ? <div className={styles.GridLayoutWrapper}><GridLayout
              className="layout"
              layout={layout}
              cols={12}
              rowHeight={30}
              width={1200}
              isResizable={false}
              isDraggable={false}
              isDroppable={false}
            >
                {layout.map(box => <div key={box.i}>
                    <BoxBody content={layoutContent[box.i]}
                        contentFormatting={contentFormatting}
                    />
                </div>)}
            </GridLayout>
            {<style jsx global>{`
                .${styles.GridLayoutWrapper} .textAlign-center .public-DraftStyleDefault-ltr {
                    text-align: center
                }
            `}</style>}
        </div> : null}
    </div>
}

const BoxBody = ({ content, contentFormatting }) => {
    if (!content)
        return null

    var formatting = {...(contentFormatting && contentFormatting[content.name] ? contentFormatting[content.name] : {})}

    return <div style={formatting}>
        <Editor
            blockStyleFn={blockStyleFn.bind(this, formatting)}
            editorState={EditorState.createWithContent(convertFromRaw(content.body))}
            readOnly={true}
        />
    </div>
}


export default GridContainer
