import React from "react"
import { Link, RouteComponentProps } from "@reach/router"
import { IProjectSummary } from "../model/projects";
import { useStoreState } from "../store"
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";

interface ProjectProps {
    project: IProjectSummary;
}

const Project: React.FC<ProjectProps> = ({ project }) => {
    const summary = project.summary ?? "(This project has no summary)";
    const linkTarget = `/ide/${project.id}`;
    return (
        <li key={project.id}>
            <Link to={linkTarget}><Alert className="ProjectCard" variant="success">
            <p><span className="project-name">{project.name}</span>
            <span className="project-summary">{summary}</span>
            </p></Alert></Link>
        </li>
    );
}

const ProjectList: React.FC<RouteComponentProps> = (props) => {
    const available = useStoreState(state => state.projectCollection.available);
    return (
        <div className="ProjectList">
            <ul>
                {available.map((p) => <Project project={p}/>)}
            </ul>
            <Button>Create a new project</Button>
        </div>

    )
};

export default ProjectList;